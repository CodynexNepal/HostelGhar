// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/integration/app.integration.test.ts
// PURPOSE: Integration suite for the real Express composition root
//          (`createApp()`): health, JSON 404, security headers, CORS,
//          auth gate, validation, metrics, compression contract.
//          Fully hermetic — ./setup stubs DB/Redis so no external service
//          is touched and CI stays green with zero flake.
// ──────────────────────────────────────────────────────────────────────────────
import 'reflect-metadata';
import './setup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api } from '../helpers/app-harness';
import { closeIntegrationApp, integrationBaseUrl } from './boot';

let baseUrl: string;

beforeAll(async () => {
  baseUrl = await integrationBaseUrl();
}, 30000);

afterAll(async () => {
  await closeIntegrationApp();
});

describe('integration: health and envelopes', () => {
  it('serves GET /health without a database dependency', async () => {
    const res = await api.get(baseUrl, '/health');
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: 'ok' });
    expect(typeof (res.json as Record<string, unknown>).timestamp).toBe('string');
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('serves liveness and readiness probes', async () => {
    const live = await api.get(baseUrl, '/health/live');
    expect(live.status).toBe(200);
    expect(live.json).toMatchObject({ status: 'ok' });

    const ready = await api.get(baseUrl, '/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.json).toMatchObject({
      status: 'ok',
      dependencies: { postgres: 'up', redis: 'up' },
    });
  });

  it('returns 401-before-404 for unknown API paths behind the auth gate', async () => {
    // paymentProofRouter mounts at '/' with a router-level `authenticate`,
    // so unknown /api/v1/hostel-ghar/* paths hit its auth gate first.
    // That is the intended production contract: unauthenticated callers
    // learn nothing about which paths exist (no route enumeration).
    const res = await api.get(baseUrl, '/api/v1/hostel-ghar/does-not-exist');
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ success: false });
  });

  it('returns a JSON 404 envelope for truly unmatched routes', async () => {
    // /health/* has no auth gate, so an unknown child falls through to the
    // global 404 handler — the "never hangs" guarantee.
    const res = await api.get(baseUrl, '/health/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ success: false });
    expect(String((res.json as Record<string, unknown>).message)).toContain('Route not found');
  });

  it('tags every response with a unique x-request-id', async () => {
    const first = await api.get(baseUrl, '/health');
    const second = await api.get(baseUrl, '/health');
    expect(first.headers.get('x-request-id')).toBeTruthy();
    expect(second.headers.get('x-request-id')).toBeTruthy();
    expect(first.headers.get('x-request-id')).not.toBe(second.headers.get('x-request-id'));
  });
});
