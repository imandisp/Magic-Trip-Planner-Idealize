# GitHub Actions CI/CD

## What runs

- `CI` (`.github/workflows/ci.yml`) runs on pull requests and pushes outside `main`. It is also reusable by the production workflow. Backend tests use Python 3.12 and an isolated PostgreSQL 17 service; Alembic applies every migration to that fresh database. Frontend checks use Node 22, `npm ci`, ESLint, and a production build. Deployment checks run failure-path tests, actionlint, and a backend Docker build. No production secrets are passed to CI.
- `Deploy production` runs on pushes to `main`, or manually with `main` selected. It first runs all CI jobs. Other branches cannot enter the production deployment job.
- Releases are serialized without cancelling an in-flight release. GitHub may replace an older *pending* run with a newer pending run; the currently running release finishes first.
- The previous manually triggered image-only workflow is replaced by this release workflow.

The release validates configuration, inspects the existing Azure resources, pulls Vercel production settings, and builds the Vercel artifact **before** modifying running Azure apps. It then builds/pushes a tagged backend image, deploys its immutable digest to the API, waits for that exact revision and database health, updates/verifies the worker, deploys the prebuilt Vercel frontend, and checks the public frontend and `/api/backend/health`. Failure stops subsequent steps. Commit, image digest, and Azure revision names appear in the Actions summary.

`Frontend/vercel.json` disables Vercel's separate Git-triggered deployment of `main`; GitHub Actions owns production so Vercel cannot bypass CI. Other branches retain the existing Vercel preview behavior. CLI production deployment is still enabled. Ensure this configuration is present on the production branch when activating the pipeline.

## One-time activation

An administrator must configure the repository environment and cloud identity before the first production run. The workflow updates existing infrastructure; it does not provision databases, buy hosting, create credentials, or migrate secrets from a developer's laptop.

1. In GitHub repository **Settings → Environments**, create `production`. Restrict deployment branches to `main`. Required reviewers are optional; leave them unset if fully automatic releases are wanted.
2. Configure Azure OIDC below and add the variables/secrets from the table. Repository-level variables also work, but environment-level values make the deployment boundary clearer.
3. Verify existing Azure secrets, PostgreSQL connectivity, and registry pull access. Both apps need the settings from `DEPLOYMENT.md`. Keep Gemini/database/session secrets on Azure, not in GitHub.
4. Set the Vercel project Root Directory to `Frontend` and its Node version to 22. Set Production `BACKEND_API_URL` to the API's default HTTPS hostname; leave `NEXT_PUBLIC_API_BASE_URL` unset. The workflow compares this value to the actual Azure API hostname and fails on a mismatch. Run Vercel CLI commands from the repository root, not `Frontend`, because the linked project already sets its root directory.
5. Set Azure `FRONTEND_ORIGINS` to the stable frontend origin, enable Secure cookies, and configure Google sign-in origins if used. `FRONTEND_URL` must be that public, stable production origin with no path. Incognito access must work without Vercel authentication; the smoke test deliberately uses no protection bypass token.
6. Merge the workflow changes into `main`. This triggers validation and deployment. For subsequent changes, open a pull request, pass CI, and merge. To redeploy the current `main`, choose **Actions → Deploy production → Run workflow → main**. A rerun creates a fresh release tag/revision using the run ID and attempt.

### GitHub production environment variables

These are identifiers/settings, not secret credentials.

| Variable | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | Application/client ID of the deployment identity configured for OIDC |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Subscription containing the application |
| `AZURE_RESOURCE_GROUP` | Existing resource group; currently `rg-magictrip` |
| `AZURE_ACR_NAME` | Registry resource name, without `.azurecr.io`; currently `magictrip72450` |
| `AZURE_API_APP_NAME` | Currently `magictrip-api-72450` |
| `AZURE_WORKER_APP_NAME` | Currently `magictrip-worker-72450` |
| `VERCEL_ORG_ID` | Vercel team/account ID from the linked project's `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Existing Vercel project ID from `.vercel/project.json` |
| `FRONTEND_URL` | Stable public frontend origin, e.g. `https://YOUR-PROJECT.vercel.app` |

The current API hostname is `https://magictrip-api-72450.wittyflower-8e7e85f1.koreacentral.azurecontainerapps.io`. Names/hostname above were inspected on 2026-09-05; use current resource values if infrastructure changes. The workflow discovers the registry login server and API hostname rather than embedding them.

### GitHub production environment secret

| Secret | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | Vercel token authorized to deploy the existing project/team |

Create the token through Vercel and paste it directly into GitHub's secret UI. Do not commit it or send it in chat. The legacy `AZURE_ACR_PUSH_CREDENTIALS` secret is no longer used.

### Azure OIDC (no stored Azure client secret)

Use a dedicated Microsoft Entra application/service principal (or user-assigned managed identity) for releases. Configure a federated credential for GitHub Actions:

```text
Issuer:   https://token.actions.githubusercontent.com
Subject:  repo:imandisp/Magic-Trip-Planner-Idealize:environment:production
Audience: api://AzureADTokenExchange
```

The subject must match the repository and the GitHub environment exactly. If using the Entra portal wizard, choose GitHub Actions, this repository, and entity type **Environment**, value **production**.

Grant the identity deployment access to the application resource group (for example, `Contributor` scoped to `rg-magictrip`) and registry push access (`AcrPush` scoped to the registry for standard registry RBAC). For an ABAC-enabled registry use its corresponding repository writer permissions instead. It does not need subscription-wide Owner or permission to change role assignments. More restrictive custom roles can replace the resource-group role.

The API and worker also need their own **runtime registry pull** permission. Existing apps use a managed identity for this. GitHub's image-push identity does not replace that runtime identity. Preserve existing secret references and registry identities; the workflow updates only image, startup command/arguments, replica counts, and revision suffix.

## Release behavior and limits

- API and worker must each have one container and use Single revision mode. API ingress must require HTTPS and target port 8000; worker ingress must be disabled. Preflight fails before deployment if those assumptions are wrong.
- The workflow sets minimum and maximum replicas to 1 for each app. The API uses its Dockerfile command (`alembic upgrade head` then Uvicorn). The worker explicitly runs `python -m app.workers.planning_worker`, replacing both old command and old arguments.
- Startup migrations execute inside Azure, so CI does not need a production database password or public database firewall access. CI's migration test runs against a separate disposable PostgreSQL database.
- Use backward-compatible, additive migrations. An old API/worker may overlap a new revision during rollout, and the old frontend remains live until the final deploy. Schema-breaking migrations require a separately planned maintenance release.
- Finish/cancel active planning work before a worker rollout when possible. This prototype does not yet have worker draining or automatic reclamation of jobs left `running` after a crash. An always-running replica and restart policy do not guarantee uninterrupted jobs.
- Worker verification checks the exact image and two healthy/running observations. It is a process-level check, not an end-to-end AI planning test or a heartbeat proving database polling. API/proxy health verifies the database; provider health is configuration/quota information, not a live Gemini test.
- This is not an atomic cross-platform release. If worker or Vercel deployment fails after the API succeeds, earlier steps remain deployed. Inspect the failed step and repair/retry; the pipeline does not silently roll back database changes.
- Single revision mode manages traffic to a ready API revision. The explicit revision/digest check prevents the old API's healthy endpoint from hiding a failed new rollout.
- Prebuilt Vercel output and pulled production environment files stay on the ephemeral runner. They are not uploaded as public workflow artifacts or committed.
- Set branch protection to require CI checks before merging. Environment configuration/branch protection requires a repository administrator; write access alone is insufficient.

## Verification and rollback

After the first successful deployment, manually test registration/login, automatic planning beyond `queued`, refresh/restore, maps/images, and Google sign-in if enabled. Automated health checks do not replace these user workflows.

Keep previous ACR release images and Vercel deployments. To recover from faulty application code, prefer reverting the code on `main` and letting the pipeline release that correction. Alternatively, an operator can update both Azure apps to a known previous digest and restore the previous Vercel deployment. First confirm compatibility with the **current database schema**. Never automatically downgrade Alembic or delete the database during rollback.

Local verification commands:

```powershell
python -m unittest discover -s scripts/tests -v
# With actionlint installed:
actionlint
```

Backend and frontend checks are documented in `README.md`. Full CI additionally validates migrations on PostgreSQL and builds the backend Docker image on Linux.

References: [Vercel CLI deployment](https://vercel.com/docs/cli/deploying-from-cli), [GitHub Actions with Vercel](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel), [Azure OIDC login action](https://github.com/Azure/login), [Azure Container Apps update](https://learn.microsoft.com/en-us/cli/azure/containerapp#az-containerapp-update), [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
