# Performance reports

Store benchmark output here with the test date, commit SHA, environment, workload, and observed p50/p95/p99 values.

Example:

```powershell
$env:API_URL = 'http://localhost:3000'
$env:BENCHMARK_REQUESTS = '500'
node performance/benchmarks/api/health.benchmark.mjs > performance/reports/health-2026-09-14.json
```

Do not commit reports containing credentials, tokens, personal data, or production hostnames.
