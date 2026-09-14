#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Hostel Ghar — Production Deployment Script (VPS / Server)
#
# Safe, zero-downtime deployment with health check verification and
# automated rollback on failure.
#
# Usage:
#   IMAGE_TAG=<commit-sha> ./scripts/deploy.sh
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG environment variable must be set to a Git commit SHA}"
REGISTRY="ghcr.io/codynexnepal/hostelghar"
FULL_IMAGE="${REGISTRY}:${IMAGE_TAG}"
COMPOSE_FILE="docker-compose.production.yml"
CONTAINER_NAME="hostelghar-app"
HEALTHCHECK_URL="http://localhost:3000/health"
MAX_HEALTH_ATTEMPTS=10
HEALTH_RETRY_DELAY=5

echo "========================================================"
echo "🚀 Starting Deployment for Hostel Ghar"
echo "Target Image: ${FULL_IMAGE}"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================================"

# Step 1: Pull target image
echo "📦 Step 1: Pulling Docker image..."
docker pull "${FULL_IMAGE}"

# Step 2: Record current running image for rollback capability
PREVIOUS_IMAGE_ID=$(docker inspect --format='{{.Image}}' "${CONTAINER_NAME}" 2>/dev/null || echo "")
echo "ℹ️ Current container image ID: ${PREVIOUS_IMAGE_ID:-None (Initial deploy)}"

# Step 3: Deploy with Compose
echo "🔄 Step 2: Starting new container..."
IMAGE_TAG="${IMAGE_TAG}" docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

# Step 4: Health Check Verification Loop
echo "🩺 Step 3: Verifying deployment health at ${HEALTHCHECK_URL}..."
HEALTHY=false

for attempt in $(seq 1 "${MAX_HEALTH_ATTEMPTS}"); do
  echo "Checking health (attempt ${attempt}/${MAX_HEALTH_ATTEMPTS})..."

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTHCHECK_URL}" || echo "000")

  if [ "${HTTP_STATUS}" = "200" ]; then
    HEALTHY=true
    echo "✅ Health check passed with HTTP 200 OK!"
    break
  fi

  echo "⚠️ Health check returned HTTP ${HTTP_STATUS}. Waiting ${HEALTH_RETRY_DELAY}s..."
  sleep "${HEALTH_RETRY_DELAY}"
done

# Step 5: Verification outcome
if [ "${HEALTHY}" = true ]; then
  echo "========================================================"
  echo "🎉 Deployment Succeeded!"
  echo "Live Image: ${FULL_IMAGE}"
  echo "========================================================"
  exit 0
else
  echo "========================================================"
  echo "❌ Deployment verification failed after ${MAX_HEALTH_ATTEMPTS} attempts."
  echo "Initiating automatic rollback..."
  echo "========================================================"

  if [ -n "${PREVIOUS_IMAGE_ID}" ]; then
    echo "Restoring previous image: ${PREVIOUS_IMAGE_ID}..."
    ./scripts/rollback.sh "${PREVIOUS_IMAGE_ID}"
  else
    echo "⚠️ No previous image found to rollback to. Container logs:"
    docker logs "${CONTAINER_NAME}" --tail 50
  fi

  exit 1
fi
