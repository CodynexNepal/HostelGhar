#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Hostel Ghar — Production Rollback Script (VPS / Server)
#
# Restores the previous verified container image on health check failure.
#
# Usage:
#   ./scripts/rollback.sh <PREVIOUS_IMAGE_ID_OR_TAG>
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PREVIOUS_IMAGE="${1:?Previous image ID or tag is required as argument 1}"
CONTAINER_NAME="hostelghar-app"
HEALTHCHECK_URL="http://localhost:8000/health"

echo "========================================================"
echo "⚠️ Initiating Emergency Rollback for Hostel Ghar"
echo "Rollback Target Image: ${PREVIOUS_IMAGE}"
echo "========================================================"

# Step 1: Revert container
echo "🔄 Rolling back container ${CONTAINER_NAME}..."
docker stop "${CONTAINER_NAME}" || true
docker rm "${CONTAINER_NAME}" || true

# Run previous image using same network and environment
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --env-file .env \
  -e NODE_ENV=production \
  -p 3000:3000 \
  --network hostelghar_hostelghar-net \
  "${PREVIOUS_IMAGE}"

echo "🩺 Verifying rollback health..."
sleep 5

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTHCHECK_URL}" || echo "000")

if [ "${HTTP_STATUS}" = "200" ]; then
  echo "✅ Rollback completed successfully and service is healthy!"
  exit 0
else
  echo "❌ CRITICAL: Rollback failed to become healthy (HTTP ${HTTP_STATUS})!"
  docker logs "${CONTAINER_NAME}" --tail 50
  exit 1
fi
