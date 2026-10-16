// ──────────────────────────────────────────────────────────────────────────────
// FILE: tests/performance/compression.performance.test.ts
// PURPOSE: Micro-benchmarks that RECORD (never gate) compression behaviour:
//          ratio per content type, encode latency per coding, and the
//          threshold guard. Results print as a table AND persist to
//          performance/reports/ so trends are reviewable in PRs. Budgets
//          below are smoke-level sanity checks only.
// ──────────────────────────────────────────────────────────────────────────────
import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import zlib from 'zlib';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compressionMiddleware } from '../../src/performance/http/compression';

const RESIDENTS = {
  items: Array.from({ length: 200 }, (_, i) => ({
    id: i,
    name: `Hostel Ghar resident ${i}`,
    room: `${100 + i}`,
  })),
};
const CSV = `name,email,room\n${'Resident,One,r1@example.com,101\n'.repeat(200)}`;

const app = express();
app.use(compressionMiddleware);
app.get('/json', (_req, res) => res.json(RESIDENTS));
app.get('/csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.send(CSV);
});
app.get('/tiny', (_req, res) => res.json({ ok: true }));

let server: http.Server;
let port = 0;

const raw = (path: string, encoding: string): Promise<{ bytes: number; raw: Buffer }> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, headers: { 'Accept-Encoding': encoding } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks);
          resolve({ bytes: rawBody.length, raw: rawBody });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

describe('performance: compression ratios and encode cost', () => {
  it('records ratios, latency and threshold behaviour', async () => {
    const plain = await raw('/json', 'identity');
    const timings: Record<string, number[]> = { br: [], gzip: [], deflate: [] };
    const sizes: Record<string, number> = {};

    for (const coding of ['br', 'gzip', 'deflate'] as const) {
      for (let i = 0; i < 5; i += 1) {
        const start = performance.now();
        const { bytes } = await raw('/json', coding);
        timings[coding]?.push(performance.now() - start);
        if (i === 0) sizes[coding] = bytes;
      }
      // Integrity: every coding must round-trip to the source payload.
      const { raw: body } = await raw('/json', coding);
      const decoded =
        coding === 'br'
          ? zlib.brotliDecompressSync(body).toString()
          : coding === 'gzip'
            ? zlib.gunzipSync(body).toString()
            : zlib.inflateSync(body).toString();
      expect(JSON.parse(decoded)).toEqual(RESIDENTS);
    }

    const csvBr = await raw('/csv', 'br');
    const tinyBr = await raw('/tiny', 'br');

    const report = {
      timestamp: new Date().toISOString(),
      uncompressed_json_bytes: plain.bytes,
      brotli_bytes: sizes.br,
      gzip_bytes: sizes.gzip,
      deflate_bytes: sizes.deflate,
      brotli_ratio: Number((Number(sizes.br) / plain.bytes).toFixed(3)),
      gzip_ratio: Number((Number(sizes.gzip) / plain.bytes).toFixed(3)),
      brotli_saved_bytes: plain.bytes - Number(sizes.br),
      csv_brotli_bytes: csvBr.bytes,
      tiny_stays_uncompressed: tinyBr.raw.toString() === JSON.stringify({ ok: true }),
      avg_encode_ms: {
        br: avg(timings.br),
        gzip: avg(timings.gzip),
        deflate: avg(timings.deflate),
      },
    };

    // Visible in CI logs…
    console.table(report);

    // …and persisted for trend review.
    const dir = join(process.cwd(), 'performance', 'reports');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `compression-${new Date().toISOString().slice(0, 10)}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );

    // Smoke-level sanity only: compression must save bytes, tiny stays raw.
    expect(Number(sizes.br)).toBeLessThan(plain.bytes);
    expect(Number(sizes.br)).toBeLessThanOrEqual(Number(sizes.gzip));
    expect(report.tiny_stays_uncompressed).toBe(true);
  }, 60000);
});

const avg = (values: number[] | undefined): number => {
  if (!values || values.length === 0) return 0;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
};
