#!/usr/bin/env bash
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:=us-central1}"
: "${AR_REPO:=turbotill}"
: "${SERVICE_NAME:=turbotill-api}"
: "${IMAGE_TAG:=$(git rev-parse --short HEAD 2>/dev/null || date +%s)}"
: "${CPU:=1}"
: "${MEMORY:=512Mi}"
: "${CONCURRENCY:=80}"
: "${MIN_INSTANCES:=0}"
: "${MAX_INSTANCES:=10}"
: "${TIMEOUT:=300s}"
: "${INGRESS:=all}"
: "${ALLOW_UNAUTHENTICATED:=true}"
: "${PUBLIC_INVOKER_STRICT:=false}"
: "${HEALTH_CHECK_PATH:=/healthz}"
: "${VALIDATE_ACCESS:=true}"
: "${ACCESS_CHECK_STRICT:=false}"

AR_HOST="${GCP_REGION}-docker.pkg.dev"
IMAGE="${AR_HOST}/${GCP_PROJECT_ID}/${AR_REPO}/${SERVICE_NAME}:${IMAGE_TAG}"

echo "Building image: ${IMAGE}"
docker build -f ./Dockerfile -t "${IMAGE}" .

echo "Pushing image: ${IMAGE}"
docker push "${IMAGE}"

DEPLOY_ARGS=(
  run deploy "${SERVICE_NAME}"
  --project "${GCP_PROJECT_ID}"
  --region "${GCP_REGION}"
  --platform managed
  --image "${IMAGE}"
  --port 8080
  --cpu "${CPU}"
  --memory "${MEMORY}"
  --concurrency "${CONCURRENCY}"
  --min-instances "${MIN_INSTANCES}"
  --max-instances "${MAX_INSTANCES}"
  --timeout "${TIMEOUT}"
  --ingress "${INGRESS}"
)

if [[ -n "${SERVICE_ACCOUNT:-}" ]]; then
  DEPLOY_ARGS+=(--service-account "${SERVICE_ACCOUNT}")
fi

if [[ -n "${SECRETS:-}" ]]; then
  DEPLOY_ARGS+=(--set-secrets "${SECRETS}")
fi

if [[ -n "${ENV_VARS:-}" ]]; then
  DEPLOY_ARGS+=(--set-env-vars "${ENV_VARS}")
fi

if [[ -n "${VPC_CONNECTOR:-}" ]]; then
  DEPLOY_ARGS+=(--vpc-connector "${VPC_CONNECTOR}" --vpc-egress private-ranges-only)
fi

if [[ "${ALLOW_UNAUTHENTICATED}" == "true" ]]; then
  DEPLOY_ARGS+=(--allow-unauthenticated)
else
  DEPLOY_ARGS+=(--no-allow-unauthenticated)
fi

echo "Deploying Cloud Run service: ${SERVICE_NAME}"
gcloud "${DEPLOY_ARGS[@]}"

if [[ "${ALLOW_UNAUTHENTICATED}" == "true" ]]; then
  echo "Ensuring public invoker access (allUsers -> roles/run.invoker)"
  set +e
  gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
    --project "${GCP_PROJECT_ID}" \
    --region "${GCP_REGION}" \
    --member "allUsers" \
    --role "roles/run.invoker" >/dev/null
  BIND_EXIT=$?
  set -e

  if [[ $BIND_EXIT -ne 0 ]]; then
    if [[ "${PUBLIC_INVOKER_STRICT}" == "true" ]]; then
      echo "Failed to grant public invoker access and strict mode is enabled."
      exit $BIND_EXIT
    fi

    echo "WARN: Could not grant allUsers run.invoker. Service may return 403 unless authenticated invocation is used."
  fi
fi

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --format='value(status.url)')"

if [[ "${VALIDATE_ACCESS}" == "true" ]]; then
  HEALTH_URL="${SERVICE_URL}${HEALTH_CHECK_PATH}"
  echo "Validating health endpoint: ${HEALTH_URL}"
  UNAUTH_STATUS="$(curl -sS -o /tmp/cloudrun-health-unauth.txt -w '%{http_code}' "${HEALTH_URL}" || true)"

  if [[ "${ALLOW_UNAUTHENTICATED}" == "true" ]]; then
    if [[ "${UNAUTH_STATUS}" != "200" && "${UNAUTH_STATUS}" != "503" ]]; then
      echo "ERROR: Unauthenticated health check returned HTTP ${UNAUTH_STATUS}"
      echo "Response preview:"
      sed -n '1,20p' /tmp/cloudrun-health-unauth.txt || true
      echo
      echo "Cloud Run ingress:"
      gcloud run services describe "${SERVICE_NAME}" \
        --project "${GCP_PROJECT_ID}" \
        --region "${GCP_REGION}" \
        --format='value(spec.template.metadata.annotations.run.googleapis.com/ingress)' || true
      echo "Invoker bindings:"
      gcloud run services get-iam-policy "${SERVICE_NAME}" \
        --project "${GCP_PROJECT_ID}" \
        --region "${GCP_REGION}" \
        --flatten='bindings[]' \
        --filter='bindings.role=roles/run.invoker' \
        --format='table(bindings.members)' || true
      if [[ "${ACCESS_CHECK_STRICT}" == "true" ]]; then
        exit 1
      fi
    else
      echo "Health check passed with HTTP ${UNAUTH_STATUS}"
    fi
  else
    TOKEN="$(gcloud auth print-identity-token 2>/dev/null || true)"
    if [[ -z "${TOKEN}" ]]; then
      echo "WARN: Could not obtain identity token for authenticated health check."
      if [[ "${ACCESS_CHECK_STRICT}" == "true" ]]; then
        exit 1
      fi
    else
      AUTH_STATUS="$(curl -sS -o /tmp/cloudrun-health-auth.txt -w '%{http_code}' \
        -H "Authorization: Bearer ${TOKEN}" "${HEALTH_URL}" || true)"
      if [[ "${AUTH_STATUS}" != "200" && "${AUTH_STATUS}" != "503" ]]; then
        echo "ERROR: Authenticated health check returned HTTP ${AUTH_STATUS}"
        sed -n '1,20p' /tmp/cloudrun-health-auth.txt || true
        if [[ "${ACCESS_CHECK_STRICT}" == "true" ]]; then
          exit 1
        fi
      else
        echo "Authenticated health check passed with HTTP ${AUTH_STATUS}"
      fi
    fi
  fi
fi

echo "Deployment completed"
echo "Service URL: ${SERVICE_URL}"
