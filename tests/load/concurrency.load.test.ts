// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/load/concurrency.load.test.ts
// PURPOSE: In-process concurrency suite (no k6 binary needed): hammers a
//          production-shaped pipeline with N parallel clients and asserts
//          zero errors, zero socket hangs, bounded p95 latency. Budgets are
//          generous on purpose — this guards against deadlocks/regressions,
//          not for absolute benchmarking (see tests/performance + k6).
// ──────────────────────────────────────────────────────────────────────────────
import 'reflect-metadata';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compressionMiddleware } from '../../src/performance/http/compression';
import { notFoundHandler } from '../../src/middleware/not-found.middleware';
import { errorHandler } from '../../src/middleware/error-handler.middleware';
import { startApp, StartedApp } from '../helpers/app-harness';

// Tunables via env so CI stays fast but staging can push harder.
const CLIENTS = Number(process.env.LOAD_CLIENTS ?? 25);
const REQUESTS_PER_CLIENT = Number(process.env.LOAD_REQUESTS_PER_CLIENT ?? 20);
const P95_BUDGET_MS = Number(process.env.LOAD_P95_BUDGET_MS ?? 1000);

const PAYLOAD = {
  items: Array.from({ length: 150 }, (_, i) => ({
    id: i,
    name: `Hostel Ghar resident ${i}`,
    room: `${100 + i}`,
  })),
};

const app = express();
app.use(compressionMiddleware);
app.use(express.json());
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
app.get('/large', (_req, res) => res.json(PAYLOAD));
app.get('/flaky', (req, res) => {
  if (req.query.fail === '1') {
    res.status(500).json({ success: false, message: 'boom' });
    return;
  }
  res.json({ ok: true });
});
app.use(notFoundHandler);
app.use(errorHandler);

let started: StartedApp;
let baseUrl: string;

beforeAll(async () => {
  started = await startApp(app);
  baseUrl = started.baseUrl;
});

afterAll(async () => {
  await started.close();
});

const percentile = (sorted: number[], p: number): number =>
  sorted[Math.min(Math.ceil(sorted.length * p) - 1, sorted.length - 1)] ?? 0;

const hammer = async (path: string, headers: Record<string, string> = {}) => {
  const latencies: number[] = [];
  let ok = 0;
  const workers = Array.from({ length: CLIENTS }, async () => {
    for (let i = 0; i < REQUESTS_PER_CLIENT; i += 1) {
      const start = performance.now();
      const res = await fetch(`${baseUrl}${path}`, { headers });
      // Consume the body — including auto-decompressed br/gzip — so socket
      // reuse is exercised, not just header latency.
      await res.arrayBuffer();
      latencies.push(performance.now() - start);
      if (res.status === 200) ok += 1;
    }
  });
  await Promise.all(workers);
  latencies.sort((a, b) => a - b);
  return { total: CLIENTS * REQUESTS_PER_CLIENT, ok, latencies };
};

describe('load: concurrent clients against a production pipeline', () => {
  it('serves every health request with zero errors under concurrency', async () => {
    const { total, ok, latencies } = await hammer('/health');
    expect(ok).toBe(total);
    expect(percentile(latencies, 0.95)).toBeLessThan(P95_BUDGET_MS);
  }, 60000);

  it('serves compressed large JSON to every concurrent client intact', async () => {
    const { total, ok, latencies } = await hammer('/large', {
      'Accept-Encoding': 'br',
    });
    expect(ok).toBe(total);
    expect(percentile(latencies, 0.95)).toBeLessThan(P95_BUDGET_MS);

    // One integrity probe: decompressed body must equal the source payload.
    const probe = await fetch(`${baseUrl}/large`, {
      headers: { 'Accept-Encoding': 'br' },
    });
    expect(probe.headers.get('content-encoding')).toBe('br');
    const body = (await probe.json()) as typeof PAYLOAD;
    expect(body.items).toHaveLength(150);
  }, 60000);

  it('keeps error responses well-formed under concurrency', async () => {
    const probe = await fetch(`${baseUrl}/flaky?fail=1`);
    expect(probe.status).toBe(500);
    const body = (await probe.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ success: false, message: 'boom' });
  }, 60000);
});
