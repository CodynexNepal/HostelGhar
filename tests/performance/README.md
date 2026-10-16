// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/performance/README.md
// PURPOSE: What lives in each suite and how to run it.
// ──────────────────────────────────────────────────────────────────────────────

# Performance (`tests/performance`)

Micro-benchmarks that RECORD (never gate): compression ratio per coding,
encode latency, threshold guard. Results print via `console.table` and
persist to `performance/reports/compression-YYYY-MM-DD.json` for PR trend
review.

- Run: `npm run test:performance` (also part of `npm test`).
- Live budgets live in `scripts/check-all.ps1` + `performance/benchmarks`.
