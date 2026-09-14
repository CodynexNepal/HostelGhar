# API Service Down

1. Run `docker compose -f docker-compose.production.yml ps` and inspect the app health status.
2. Read the last logs with `docker compose -f docker-compose.production.yml logs --since=15m app`.
3. Check whether the container exited, hit its memory limit, or failed its startup dependency.
4. Verify `/health/live` and `/health/ready` after recovery.
5. Roll back to the last known-good immutable image tag when a deployment caused the failure.
