#!/usr/bin/env bash
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:=us-central1}"
: "${SERVICE_NAME:=turbotill-api}"
: "${HEALTH_CHECK_PATH:=/healthz}"
: "${CUSTOM_API_BASE_URL:=}"
: "${FRONTEND_ORIGIN_CHECK:=https://turbotill.xyz}"

URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --format='value(status.url)')"

check_base_url() {
  local label="$1"
  local base_url="$2"
  local health_url="${base_url}${HEALTH_CHECK_PATH}"
  local api_health_url="${base_url}/api/v1/health"
  local preflight_url="${base_url}/api/v1/auth/login"

  echo "=== ${label} ==="
  echo "Base URL: ${base_url}"
  echo "Health URL: ${health_url}"

  UNAUTH_STATUS="$(curl -sS -o /tmp/cloudrun-health-unauth.txt -w '%{http_code}' "${health_url}" || true)"
  echo "Unauthenticated status: ${UNAUTH_STATUS}"
  sed -n '1,20p' /tmp/cloudrun-health-unauth.txt || true
  echo

  TOKEN="$(gcloud auth print-identity-token 2>/dev/null || true)"
  if [[ -n "${TOKEN}" ]]; then
    AUTH_STATUS="$(curl -sS -o /tmp/cloudrun-health-auth.txt -w '%{http_code}' \
      -H "Authorization: Bearer ${TOKEN}" "${health_url}" || true)"
    echo "Authenticated status: ${AUTH_STATUS}"
    sed -n '1,20p' /tmp/cloudrun-health-auth.txt || true
  else
    echo "Authenticated status: skipped (could not obtain identity token)"
  fi
  echo

  API_HEALTH_STATUS="$(curl -sS -o /tmp/cloudrun-api-health-unauth.txt -w '%{http_code}' "${api_health_url}" || true)"
  echo "API health status (/api/v1/health): ${API_HEALTH_STATUS}"
  sed -n '1,20p' /tmp/cloudrun-api-health-unauth.txt || true
  echo

  echo "CORS preflight check (${FRONTEND_ORIGIN_CHECK} -> ${preflight_url})"
  PREFLIGHT_STATUS="$(curl -sS -o /tmp/cloudrun-preflight.txt -D /tmp/cloudrun-preflight-headers.txt -w '%{http_code}' \
    -X OPTIONS "${preflight_url}" \
    -H "Origin: ${FRONTEND_ORIGIN_CHECK}" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" || true)"
  echo "Preflight status: ${PREFLIGHT_STATUS}"
  echo "Response headers:"
  sed -n '1,40p' /tmp/cloudrun-preflight-headers.txt || true
  echo "Preflight body preview:"
  sed -n '1,20p' /tmp/cloudrun-preflight.txt || true
  echo
}

echo "Service URL: ${URL}"
echo "Frontend origin for CORS check: ${FRONTEND_ORIGIN_CHECK}"
echo

echo "Revision + image:"
gcloud run services describe "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --format='yaml(status.latestReadyRevisionName,status.latestCreatedRevisionName,status.traffic,spec.template.spec.containers[0].image)' || true
echo

echo "Ingress config (service/revision annotations):"
gcloud run services describe "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --format='yaml(metadata.annotations,spec.template.metadata.annotations)' || true
echo

echo "Invoker IAM bindings:"
gcloud run services get-iam-policy "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --format='table(bindings.role,bindings.members)' || true
echo

check_base_url "Cloud Run Service URL" "${URL}"

if [[ -n "${CUSTOM_API_BASE_URL}" ]]; then
  check_base_url "Custom API Domain" "${CUSTOM_API_BASE_URL}"
fi

echo "Recent logs:"
gcloud run services logs read "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --limit 30 || true
