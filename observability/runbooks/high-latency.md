# High API Latency

1. Use p95 and p99 panels to identify when latency increased; averages can hide tail failures.
2. Break down request latency by route in Prometheus.
3. Open slow Tempo traces and follow the longest child span.
4. Search Loki using the trace ID and check PostgreSQL query latency, locks, and Redis status.
5. Check CPU, memory, and container throttling before changing application limits.
6. Roll back the suspected deployment or remediate the slow dependency, then confirm p95 returns below the SLO threshold.
