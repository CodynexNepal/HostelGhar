# PostgreSQL Failure

1. Check `GET /health/ready` and the PostgreSQL exporter target.
2. Run `docker compose ps` and `docker compose logs --since=15m postgres`.
3. Check connection saturation, locks, deadlocks, and disk capacity in Grafana.
4. Confirm `DATABASE_URL` is supplied through the runtime environment and is not printed in logs.
5. Restore connectivity or fail over according to the database provider procedure.
6. Validate readiness, request errors, and traces after recovery.
