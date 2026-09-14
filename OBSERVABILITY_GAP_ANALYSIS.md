# Observability Gap Analysis

## Current state

HostelGhar is a TypeScript/Express API deployed with Docker Compose. It uses PostgreSQL, Redis, BullMQ workers, Socket.IO, and Docker health checks. Production already has container resource limits and JSON log rotation.

## Gaps addressed

- Added low-cardinality Prometheus RED metrics and Node.js default process metrics.
- Added request IDs, trace/span fields, and structured JSON request logs.
- Added liveness, readiness, and metrics endpoints.
- Added OpenTelemetry auto-instrumentation with OTLP export when configured.
- Added Docker-only Prometheus, Alertmanager, Grafana, Loki/Promtail, Tempo, OTel Collector, and PostgreSQL/Redis exporters.
- Added symptom-based alerts, recording rules, and a golden-signals dashboard.

## Deliberate boundaries

Kubernetes manifests and ServiceMonitor resources are intentionally omitted because this deployment uses Docker Compose. The Docker Compose stack is intended for a secured internal network; bind-mounted UIs bind to localhost by default.

Prometheus labels do not include user IDs, request IDs, emails, UUIDs, or URLs with arbitrary path parameters. Those values belong in logs or traces, where retention and access can be controlled separately.

## Remaining production decisions

- Configure Alertmanager SMTP, Slack, or PagerDuty credentials outside Git.
- Put Grafana, Prometheus, Loki, Tempo, and Alertmanager behind an authenticated reverse proxy or private network before remote access.
- Use durable encrypted volumes and backups for Grafana, Prometheus, Loki, and Tempo according to retention needs.
- Add a tail-sampling policy in the collector when trace volume requires cost control.
- Test failure scenarios in staging before enabling critical paging.
