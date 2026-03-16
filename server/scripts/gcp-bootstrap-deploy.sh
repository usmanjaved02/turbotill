#!/usr/bin/env bash
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:=us-central1}"
: "${SERVICE_NAME:=turbotill-api}"
: "${AR_REPO:=turbotill}"
: "${RUNTIME_SA:=turbotill-cloudrun-sa}"
: "${ALLOW_UNAUTHENTICATED:=true}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd -- "${SERVER_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${SERVER_DIR}/.env}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found. Install it: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q .; then
  gcloud auth login
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

get_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "${ENV_FILE}" | head -n 1
}

MONGODB_URI="$(get_env MONGODB_URI)"
JWT_ACCESS_SECRET="$(get_env JWT_ACCESS_SECRET)"
GEMINI_API_KEY="$(get_env GEMINI_API_KEY)"
FRONTEND_ORIGIN="$(get_env FRONTEND_ORIGIN)"
COOKIE_DOMAIN="$(get_env COOKIE_DOMAIN)"

if [[ -z "${MONGODB_URI}" || -z "${JWT_ACCESS_SECRET}" || -z "${FRONTEND_ORIGIN}" || -z "${COOKIE_DOMAIN}" ]]; then
  echo "Required values missing in ${ENV_FILE} (MONGODB_URI, JWT_ACCESS_SECRET, FRONTEND_ORIGIN, COOKIE_DOMAIN)"
  exit 1
fi

gcloud config set project "${GCP_PROJECT_ID}" >/dev/null
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT_ID}" --format='value(projectNumber)')"
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
RUNTIME_SA_EMAIL="${RUNTIME_SA}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "${RUNTIME_SA}" \
  --display-name "TurboTill Cloud Run Runtime" 2>/dev/null || true

gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role "roles/secretmanager.secretAccessor" >/dev/null

gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member "serviceAccount:${CLOUDBUILD_SA}" \
  --role "roles/run.admin" >/dev/null

gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member "serviceAccount:${CLOUDBUILD_SA}" \
  --role "roles/iam.serviceAccountUser" >/dev/null

gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member "serviceAccount:${CLOUDBUILD_SA}" \
  --role "roles/artifactregistry.writer" >/dev/null

gcloud artifacts repositories create "${AR_REPO}" \
  --repository-format docker \
  --location "${GCP_REGION}" \
  --description "TurboTill backend images" 2>/dev/null || true

for secret in MONGODB_URI JWT_ACCESS_SECRET GEMINI_API_KEY; do
  gcloud secrets create "${secret}" --replication-policy="automatic" 2>/dev/null || true
done

printf '%s' "${MONGODB_URI}" | gcloud secrets versions add MONGODB_URI --data-file=- >/dev/null
printf '%s' "${JWT_ACCESS_SECRET}" | gcloud secrets versions add JWT_ACCESS_SECRET --data-file=- >/dev/null

if [[ -n "${GEMINI_API_KEY}" ]]; then
  printf '%s' "${GEMINI_API_KEY}" | gcloud secrets versions add GEMINI_API_KEY --data-file=- >/dev/null
  GEMINI_SECRET_REF="GEMINI_API_KEY:latest"
else
  GEMINI_SECRET_REF=""
fi

set +e
BUILD_OUTPUT="$(
  gcloud builds submit "${REPO_ROOT}" \
    --config "${REPO_ROOT}/cloudbuild.yaml" \
    --substitutions "_SERVICE_NAME=${SERVICE_NAME},_REGION=${GCP_REGION},_AR_HOST=${GCP_REGION}-docker.pkg.dev,_AR_REPO=${AR_REPO},_SERVICE_ACCOUNT=${RUNTIME_SA_EMAIL},_SECRET_MONGODB_URI=MONGODB_URI:latest,_SECRET_JWT_ACCESS_SECRET=JWT_ACCESS_SECRET:latest,_SECRET_GEMINI_API_KEY=${GEMINI_SECRET_REF},_NODE_ENV=production,_FRONTEND_ORIGIN=${FRONTEND_ORIGIN},_COOKIE_DOMAIN=${COOKIE_DOMAIN},_ALLOW_UNAUTHENTICATED=${ALLOW_UNAUTHENTICATED}" 2>&1
)"
BUILD_EXIT=$?
set -e

echo "${BUILD_OUTPUT}"

if [[ ${BUILD_EXIT} -ne 0 ]]; then
  if command -v rg >/dev/null 2>&1; then
    BUILD_ID="$(printf '%s\n' "${BUILD_OUTPUT}" | rg -o 'build [0-9a-f-]{36}' | tail -n 1 | awk '{print $2}')"
  else
    BUILD_ID="$(printf '%s\n' "${BUILD_OUTPUT}" | grep -Eo 'build [0-9a-f-]{36}' | tail -n 1 | awk '{print $2}')"
  fi
  if [[ -n "${BUILD_ID}" ]]; then
    echo
    echo "Cloud Build failed. Streaming logs for build ${BUILD_ID}..."
    gcloud builds log --stream "${BUILD_ID}" --project "${GCP_PROJECT_ID}" || true
  fi
  exit ${BUILD_EXIT}
fi
