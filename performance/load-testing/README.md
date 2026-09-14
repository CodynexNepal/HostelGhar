# Docker load testing

Install k6 on the host, start the Docker API, then run:

```powershell
k6 run performance/load-testing/k6/smoke.test.js
k6 run performance/load-testing/k6/load.test.js
k6 run performance/load-testing/k6/stress.test.js
```

Set `API_URL` to target another Docker-published API endpoint. These scenarios use liveness only and do not create or mutate production data.
