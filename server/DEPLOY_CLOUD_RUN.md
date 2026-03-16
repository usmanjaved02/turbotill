# Turbo Tll Backend Deployment (Google Cloud Run)

Challenge: **Gemini Live Agent Challenge**

This guide is written for challenge reviewers and teammates who need a reproducible, production-style deployment flow.

## What Is Automated

The backend deployment is automated end-to-end:

- Container build with multi-stage Docker (`server/Dockerfile`)
- Image push to Artifact Registry
- Cloud Run deploy with runtime settings
- Secret injection from Secret Manager
- IAM setup for runtime and CI/CD service accounts
- Optional public invoker binding (`allUsers -> roles/run.invoker`)
- Post-deploy access diagnostics (health + CORS preflight checks)

## Deployment Architecture

- CI/CD pipeline config: `cloudbuild.yaml` (repo root)
- Bootstrap automation: `server/scripts/gcp-bootstrap-deploy.sh`
- Direct/local deploy helper: `server/scripts/deploy-cloud-run.sh`
- Access diagnostics: `server/scripts/gcp-access-check.sh`
- npm entrypoints: `server/package.json` scripts

## One-Command Deploy (Recommended)

From `server/`:

```bash
GCP_PROJECT_ID=<PROJECT_ID> npm run gcp:bootstrap-deploy
```

What this one command does:

1. Validates `gcloud` auth/project.
2. Enables required Google APIs.
3. Creates/updates IAM service accounts and bindings.
4. Ensures Artifact Registry repo exists.
5. Creates/rotates Secret Manager versions from `server/.env`.
6. Triggers Cloud Build using `cloudbuild.yaml`.
7. Streams build logs automatically if the build fails.

## Required One-Time Setup

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project <PROJECT_ID>
```

## Environment and Secrets Source

`gcp-bootstrap-deploy.sh` reads these values from `server/.env`:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `GEMINI_API_KEY` (optional)
- `FRONTEND_ORIGIN`
- `COOKIE_DOMAIN`

It then uploads them to Secret Manager and deploys Cloud Run with:

- Secret envs:
  - `MONGODB_URI`
  - `JWT_ACCESS_SECRET`
  - `GEMINI_API_KEY` (if present)
- Runtime envs:
  - `NODE_ENV=production`
  - `FRONTEND_ORIGIN=<value from .env>`
  - `COOKIE_DOMAIN=<value from .env>`

## Script Reference

From `server/`:

```bash
# Full bootstrap + deploy
GCP_PROJECT_ID=<PROJECT_ID> npm run gcp:bootstrap-deploy

# Direct deploy path (manual/local image build and deploy)
GCP_PROJECT_ID=<PROJECT_ID> npm run deploy:cloudrun

# Service metadata and logs
GCP_PROJECT_ID=<PROJECT_ID> npm run gcp:service:url
GCP_PROJECT_ID=<PROJECT_ID> npm run gcp:service:describe
GCP_PROJECT_ID=<PROJECT_ID> npm run gcp:service:logs

# Deep access diagnostics (Cloud Run URL + optional custom domain)
GCP_PROJECT_ID=<PROJECT_ID> npm run gcp:access:check

# Stream a specific failed Cloud Build
GCP_PROJECT_ID=<PROJECT_ID> BUILD_ID=<CLOUD_BUILD_ID> npm run gcp:build:log
```

## Optional Deploy Overrides

Set before `npm run gcp:bootstrap-deploy`:

- `GCP_REGION` (default `us-central1`)
- `SERVICE_NAME` (default `turbotill-api`)
- `AR_REPO` (default `turbotill`)
- `RUNTIME_SA` (default `turbotill-cloudrun-sa`)
- `ALLOW_UNAUTHENTICATED` (default `true`)

## Health Endpoints

The backend exposes:

- `GET /healthz`
- `GET /health` (alias)
- `GET /api/v1/health`

## Custom Domain + CORS Validation

To test production domain behavior and preflight from frontend origin:

```bash
GCP_PROJECT_ID=<PROJECT_ID> \
CUSTOM_API_BASE_URL=https://api.turbotill.xyz \
FRONTEND_ORIGIN_CHECK=https://turbotill.xyz \
HEALTH_CHECK_PATH=/api/v1/health \
npm run gcp:access:check
```

This script reports:

- Cloud Run service URL status
- Custom domain status
- Invoker IAM bindings
- CORS preflight result for `OPTIONS /api/v1/auth/login`
- Recent Cloud Run logs

## Common 403/CORS Notes

- If `OPTIONS` or health checks return `403` with no app CORS headers, the request is blocked before Express (IAM/ingress/org policy/custom domain proxy).
- If Cloud Run URL works but custom domain fails, fix domain mapping or DNS/proxy config.
- If public invoker is blocked by org policy, unauthenticated browser requests will fail until policy is adjusted.

## Why This Is Challenge-Ready

- Fully scriptable and reproducible deployment process
- Secure secret handling via Secret Manager
- CI/CD and local deploy paths both supported
- Clear operational diagnostics for real-world 403/CORS failures
- Production-lean defaults with explicit override controls
