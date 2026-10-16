// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/integration/security.integration.test.ts
// PURPOSE: Integration coverage for the cross-cutting production pipeline:
//          helmet headers on success AND error responses, CORS preflight,
//          auth gate shape, DTO validation short-circuit, metrics and the
//          compression Vary contract. Hermetic via ./setup (no DB/Redis).
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

describe('integration: production pipeline', () => {
  it('keeps helmet headers on API AND error responses', async () => {
    const ok = await api.get(baseUrl, '/health');
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
    expect(ok.headers.get('x-powered-by')).toBeNull();

    const missing = await api.get(baseUrl, '/nope');
    expect(missing.status).toBe(404);
    expect(missing.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('answers CORS preflight with 204 and never compresses it', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hostel-ghar/auth/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('content-encoding')).toBeNull();
    await res.text();
  });

  it('requires authentication on a protected route (401 JSON)', async () => {
    const res = await api.get(baseUrl, '/api/v1/hostel-ghar/auth/me');
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ success: false });
    expect(res.text).not.toContain('stack');
  });

  it('rejects malformed login bodies with 422 before services run', async () => {
    const res = await api.post(baseUrl, '/api/v1/hostel-ghar/auth/login', {
      email: 'not-an-email',
      password: '',
    });
    expect(res.status).toBe(422);
    expect(res.json).toMatchObject({ success: false });
  });

  it('exposes Prometheus metrics including compression counters', async () => {
    const res = await api.get(baseUrl, '/metrics');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_responses_compressed_total');
  });

  it('sets Vary: Accept-Encoding on negotiated responses', async () => {
    const res = await fetch(`${baseUrl}/metrics`, {
      headers: { 'Accept-Encoding': 'br' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('vary')).toContain('Accept-Encoding');
    await res.text();
  });
});
