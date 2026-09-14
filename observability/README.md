# Docker Observability

This repository uses Docker Compose, so no Kubernetes resources are included.

## Start the application dependencies

From the repository root:

```powershell
docker compose up -d
```

For production, provide `IMAGE_TAG` and start `docker-compose.production.yml` as documented in that file.

## Start observability

The stack expects the API on `localhost:3000`, PostgreSQL on `localhost:5432`, and Redis on `localhost:6379`.

```powershell
$env:GRAFANA_ADMIN_PASSWORD = 'use-a-secret-from-your-secret-store'
$env:POSTGRES_EXPORTER_DSN = 'postgresql://hostelghar:hostelghar_dev_pass@host.docker.internal:5432/hostelghar_dev?sslmode=disable'
Set-Location observability/docker
docker compose -f docker-compose.observability.yml up -d
```

For production, set `OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318` and `OTEL_SERVICE_NAME=hostelghar-api` in the API container environment. Telemetry export is optional and never blocks API startup when the endpoint is absent.

## Local endpoints

- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093
- Loki: http://localhost:3100/ready
- Tempo: http://localhost:3200/ready
- API metrics: http://localhost:3000/metrics
- API liveness: http://localhost:3000/health/live
- API readiness: http://localhost:3000/health/ready

Grafana is provisioned with Prometheus, Loki, Tempo, and the application overview dashboard. The default Grafana username is `admin`; the password is the value supplied through `GRAFANA_ADMIN_PASSWORD`.

## Verification

```powershell
curl.exe http://localhost:3000/metrics
curl.exe http://localhost:3000/health/live
curl.exe http://localhost:3000/health/ready
docker compose -f docker-compose.observability.yml ps
docker compose -f docker-compose.observability.yml logs --tail=100 otel-collector
```

The application emits JSON logs to stdout. Promtail reads Docker JSON logs and sends them to Loki. Request logs include `request_id` and, when tracing is enabled, `trace_id` and `span_id`. Keep all observability endpoints private or put them behind authenticated TLS before exposing them outside the host.
