import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import mock_open, patch

spec = importlib.util.spec_from_file_location("deploy", Path(__file__).parents[1] / "deploy.py")
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(deploy.os.environ, {"AZURE_RESOURCE_GROUP": "test-rg"})
        environment.start()
        self.addCleanup(environment.stop)

    def state(self, **changes):
        return dict({"images": ["registry/backend@sha256:abc"], "health": "Healthy",
                     "running": "RunningAtMaxScale", "provisioning": "Provisioned",
                     "active": True}, **changes)

    def test_old_healthy_revision_cannot_pass_release_check(self):
        with patch.object(deploy, "az", return_value=self.state(images=["old-image"])):
            with self.assertRaisesRegex(RuntimeError, "does not match"):
                deploy.wait_revision("api", "api--new", "registry/backend@sha256:abc")

    def test_crashed_worker_fails_release(self):
        with patch.object(deploy, "az", return_value=self.state(running="Failed")):
            with self.assertRaisesRegex(RuntimeError, "failed"):
                deploy.wait_revision("worker", "worker--new", "registry/backend@sha256:abc")

    def test_worker_must_remain_healthy_across_observations(self):
        with patch.object(deploy, "az", side_effect=[self.state(), self.state(running="Failed")]), \
                patch.object(deploy.time, "sleep"):
            with self.assertRaises(RuntimeError):
                deploy.wait_revision("worker", "worker--new", "registry/backend@sha256:abc")

    def test_healthy_revision_completes_after_two_observations(self):
        with patch.object(deploy, "az", return_value=self.state()) as azure, \
                patch.object(deploy.time, "sleep"):
            deploy.wait_revision("api", "api--new", "registry/backend@sha256:abc")
            self.assertEqual(azure.call_count, 2)

    def test_nonready_revision_times_out(self):
        with patch.object(deploy, "az", return_value=self.state(health="None")), \
                patch.object(deploy.time, "monotonic", side_effect=[0, 0, 601]), \
                patch.object(deploy.time, "sleep"):
            with self.assertRaises(TimeoutError):
                deploy.wait_revision("api", "api--new", "registry/backend@sha256:abc")

    def test_worker_with_public_ingress_is_rejected(self):
        info = {"mode": "Single", "containers": [{}], "ingress": {"external": True}}
        with self.assertRaisesRegex(RuntimeError, "Disable ingress"):
            deploy.validate_target(info, worker=True)

    def test_multiple_revision_mode_is_rejected(self):
        info = {"mode": "Multiple", "containers": [{}]}
        with self.assertRaisesRegex(RuntimeError, "Single revision"):
            deploy.validate_target(info)

    def test_http_200_with_unhealthy_database_does_not_pass(self):
        response = io.BytesIO(b'{"status":"ok","database":"unavailable"}')
        with patch.object(deploy, "urlopen", return_value=response), \
                patch.object(deploy.time, "monotonic", side_effect=[0, 0, 181]), \
                patch.object(deploy.time, "sleep"):
            with self.assertRaises(TimeoutError):
                deploy.check_http("https://example.com/health", database=True)

    def test_http_url_is_rejected(self):
        with self.assertRaises(ValueError):
            deploy.check_http("http://example.com")

    def test_release_replaces_worker_args_and_uses_digest(self):
        info = {"mode": "Single", "containers": [{"name": "worker", "image": "old"}], "ingress": None}
        environment = {"AZURE_WORKER_APP_NAME": "worker", "RELEASE_IMAGE": "registry/backend@sha256:abc",
                       "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "2", "GITHUB_STEP_SUMMARY": "unused"}
        with patch.dict(deploy.os.environ, environment), patch.object(deploy, "app_info", return_value=info), \
                patch.object(deploy, "az") as azure, patch.object(deploy, "wait_revision") as wait, \
                patch.object(deploy.Path, "open", mock_open()):
            deploy.deploy(worker=True)
            args = azure.call_args.args
            self.assertIn("--args=-mapp.workers.planning_worker", args)
            self.assertEqual(args[args.index("--image") + 1], environment["RELEASE_IMAGE"])
            wait.assert_called_once_with("worker", "worker--gh-123-2", environment["RELEASE_IMAGE"])

    def test_failed_revision_prevents_api_health_success(self):
        info = {"mode": "Single", "containers": [{"name": "api"}],
                "ingress": {"external": True, "targetPort": 8000, "allowInsecure": False}}
        environment = {"AZURE_API_APP_NAME": "api", "RELEASE_IMAGE": "registry/backend@sha256:abc",
                       "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "2"}
        with patch.dict(deploy.os.environ, environment), patch.object(deploy, "app_info", return_value=info), \
                patch.object(deploy, "az") as azure, \
                patch.object(deploy, "wait_revision", side_effect=RuntimeError("failed")), \
                patch.object(deploy, "check_http") as http:
            with self.assertRaises(RuntimeError):
                deploy.deploy()
            http.assert_not_called()
            args = azure.call_args.args
            self.assertEqual(args[args.index("--command") + 1], "")
            self.assertEqual(args[args.index("--args") + 1], "")


if __name__ == "__main__":
    unittest.main()
