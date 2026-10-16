// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/integration/README.md
// PURPOSE: What lives in each suite and how to run it.
// ──────────────────────────────────────────────────────────────────────────────

# Integration (`tests/integration`)

Hermetic suites against the REAL `createApp()` composition root — middleware
order, health, JSON 404, helmet, CORS preflight, auth gate, DTO validation,
metrics, compression contract.

- `setup.ts` stubs DB/Redis/BullMQ/Socket.io at module scope so no external
  service is dialled (no ECONNREFUSED, no flake).
- `boot.ts` shares one server per worker (30s hook timeout).
- Run: `npm run test:integration` (also part of `npm test`).
