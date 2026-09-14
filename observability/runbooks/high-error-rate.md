# High API Error Rate

1. Open the Grafana application dashboard and identify the affected route and start time.
2. Query Loki for `{service="hostelghar-api", level="error"}` and correlate `trace_id`.
3. Inspect the corresponding Tempo trace for database, Redis, or external-call failures.
4. Check the latest deployment and container logs with `docker compose logs --since=15m app`.
5. Check PostgreSQL and Redis exporter health before rollback or restart.
6. Mitigate with rollback, dependency recovery, or traffic reduction, then verify the error-rate alert resolves.
