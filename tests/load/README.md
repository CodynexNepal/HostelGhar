// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/load/README.md
// PURPOSE: What lives in each suite and how to run it.
// ──────────────────────────────────────────────────────────────────────────────

# Load (`tests/load`)

In-process concurrency without a k6 binary: N parallel `fetch` clients
hammer a production-shaped pipeline (compression + JSON + 404 + errors).

- Default: 25 clients × 20 requests; tune via `LOAD_CLIENTS`,
  `LOAD_REQUESTS_PER_CLIENT`, `LOAD_P95_BUDGET_MS`.
- Budgets are generous regression guards (deadlocks/hangs), not absolute
  benchmarks — see `tests/performance` + `performance/load-testing/k6`.
- Run: `npm run test:load` (also part of `npm test`).
- Staging soak: `k6 run performance/load-testing/k6/load.test.js`.
