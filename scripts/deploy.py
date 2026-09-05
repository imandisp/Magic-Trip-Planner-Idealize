"""Release helpers. Azure output is projected so application secrets never reach logs."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import urlopen


def az(*args):
    result = subprocess.run(
        ["az", *args, "--only-show-errors", "--output", "json"],
        check=True, capture_output=True, text=True, timeout=180,
    )
    return json.loads(result.stdout) if result.stdout.strip() else None


def app_args(name):
    return ("--resource-group", os.environ["AZURE_RESOURCE_GROUP"], "--name", name)


def app_info(name):
    return az(
        "containerapp", "show", *app_args(name), "--query",
        "{mode:properties.configuration.activeRevisionsMode,"
        "ingress:properties.configuration.ingress,"
        "containers:properties.template.containers[].{name:name,image:image}}",
    )


def validate_target(info, worker=False):
    if info["mode"] != "Single" or len(info["containers"]) != 1:
        raise RuntimeError("Deployment requires Single revision mode and one container per app.")
    ingress = info.get("ingress")
    if worker:
        if ingress is not None:
            raise RuntimeError("Disable ingress on the planning worker before deploying.")
    elif not ingress or not ingress.get("external") or ingress.get("targetPort") != 8000:
        raise RuntimeError("API must have external ingress on target port 8000.")
    elif ingress.get("allowInsecure"):
        raise RuntimeError("Disable insecure HTTP ingress on the API.")


def preflight():
    api_name = os.environ["AZURE_API_APP_NAME"]
    worker_name = os.environ["AZURE_WORKER_APP_NAME"]
    if api_name == worker_name:
        raise RuntimeError("API and worker must be different Container Apps.")
    api = app_info(api_name)
    validate_target(api)
    validate_target(app_info(worker_name), worker=True)
    registry = az("acr", "show", "--name", os.environ["AZURE_ACR_NAME"], "--query", "loginServer")
    values = {
        "ACR_LOGIN_SERVER": registry,
        "AZURE_API_URL": "https://" + api["ingress"]["fqdn"],
    }
    with Path(os.environ["GITHUB_ENV"]).open("a", encoding="utf-8") as output:
        for key, value in values.items():
            if not value or "\n" in value or "\r" in value:
                raise RuntimeError("Invalid Azure resource output.")
            output.write(f"{key}={value}\n")
    print("Verified existing Azure apps and registry.", flush=True)


def wait_revision(name, revision, image, timeout=600):
    deadline = time.monotonic() + timeout
    consecutive_ready = 0
    while time.monotonic() < deadline:
        state = az(
            "containerapp", "revision", "show", *app_args(name), "--revision", revision,
            "--query", "{health:properties.healthState,running:properties.runningState,"
            "provisioning:properties.provisioningState,active:properties.active,"
            "images:properties.template.containers[].image}",
        )
        if state["images"] != [image]:
            raise RuntimeError("Revision image does not match the release digest.")
        if state["provisioning"] in ("Failed", "Deprovisioned") or state["running"] in (
            "Failed", "Degraded", "Stopped",
        ):
            raise RuntimeError(f"Revision {revision} failed: {state['running']} / {state['provisioning']}")
        ready = (
            state["active"] and state["health"] == "Healthy"
            and state["provisioning"] == "Provisioned"
            and state["running"] in ("Running", "RunningAtMaxScale")
        )
        consecutive_ready = consecutive_ready + 1 if ready else 0
        # A second observation catches immediate worker startup crashes.
        if consecutive_ready >= 2:
            print(f"Revision {revision} is running the release image.", flush=True)
            return
        time.sleep(10)
    raise TimeoutError(f"Revision {revision} did not become healthy within {timeout} seconds.")


def check_http(url, database=False, timeout=180):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Smoke checks require an HTTPS URL without embedded credentials.")
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=20) as response:
                if database:
                    state = json.load(response)
                    healthy = state.get("status") == "ok" and state.get("database") == "ok"
                else:
                    healthy = response.status == 200 and "text/html" in response.headers.get("Content-Type", "")
                if healthy and urlsplit(response.url).netloc == parsed.netloc:
                    print(f"Smoke check passed: {url}", flush=True)
                    return
        except (URLError, TimeoutError, ValueError):
            pass
        time.sleep(10)
    raise TimeoutError(f"Smoke check failed: {url}")


def deploy(worker=False):
    name = os.environ["AZURE_WORKER_APP_NAME" if worker else "AZURE_API_APP_NAME"]
    info = app_info(name)
    validate_target(info, worker=worker)
    image = os.environ["RELEASE_IMAGE"]
    if "@sha256:" not in image:
        raise ValueError("Deploy an immutable image digest, not a mutable tag.")
    suffix = f"gh-{os.environ['GITHUB_RUN_ID']}-{os.environ['GITHUB_RUN_ATTEMPT']}"
    # Clear BOTH existing command and args for the API. Worker args also need
    # replacement: older deployments used a script path instead of module mode.
    # Python accepts -mMODULE. Keeping it one --args=value avoids Azure CLI
    # treating a separate -m as one of its own options.
    command = ("--command", "python", "--args=-mapp.workers.planning_worker") if worker else (
        "--command", "", "--args", "",
    )
    az(
        "containerapp", "update", *app_args(name),
        "--container-name", info["containers"][0]["name"], "--image", image,
        "--revision-suffix", suffix, "--min-replicas", "1", "--max-replicas", "1",
        *command, "--query", "properties.latestRevisionName",
    )
    revision = f"{name}--{suffix}"
    wait_revision(name, revision, image)
    if not worker:
        check_http(os.environ["AZURE_API_URL"] + "/health", database=True)
    with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a", encoding="utf-8") as output:
        output.write(f"Azure {'worker' if worker else 'API'} revision: `{revision}`\n\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=("preflight", "api", "worker", "smoke"))
    stage = parser.parse_args().stage
    if stage == "preflight":
        preflight()
    elif stage in ("api", "worker"):
        deploy(worker=stage == "worker")
    else:
        origin = os.environ["FRONTEND_URL"].rstrip("/")
        check_http(origin)
        check_http(origin + "/api/backend/health", database=True)


if __name__ == "__main__":
    main()
