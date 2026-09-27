import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import zlib from 'zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compressionMiddleware,
  isCompressibleContentType,
  negotiateContentCoding,
} from '../../src/performance/http/compression';

// A payload comfortably above the 1 KiB compression threshold.
const LARGE_JSON = {
  items: Array.from({ length: 200 }, (_, index) => ({
    id: index,
    name: `Hostel Ghar resident ${index}`,
    room: `${index + 100}`,
  })),
};
const RAW_JSON = JSON.stringify(LARGE_JSON);

const app = express();
app.use(compressionMiddleware);
app.get('/json', (_req, res) => res.json(LARGE_JSON));
app.get('/small', (_req, res) => res.json({ ok: true }));
app.get('/binary', (_req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.end(Buffer.alloc(4096, 7));
});
app.get('/no-transform', (_req, res) => {
  res.setHeader('Cache-Control', 'no-transform');
  res.json(LARGE_JSON);
});
app.get('/opt-out', (_req, res) => res.json(LARGE_JSON));

interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

let server: http.Server;
let port = 0;

/** Raw http.request so the test controls Accept-Encoding and sees real bytes. */
const fetchRaw = (path: string, headers: Record<string, string> = {}): Promise<RawResponse> =>
  new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () =>
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks),
        }),
      );
    });
    request.on('error', reject);
    request.end();
  });

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe('content coding negotiation', () => {
  it('prefers Brotli, then gzip, then deflate', () => {
    expect(negotiateContentCoding('gzip, deflate, br')).toBe('br');
    expect(negotiateContentCoding('gzip, deflate')).toBe('gzip');
    expect(negotiateContentCoding('deflate')).toBe('deflate');
    expect(negotiateContentCoding('*')).toBe('br');
  });

  it('honours q-values and treats identity as no compression', () => {
    expect(negotiateContentCoding('br;q=0, gzip')).toBe('gzip');
    expect(negotiateContentCoding('br;q=0.1, gzip;q=0.9')).toBe('gzip');
    expect(negotiateContentCoding('identity')).toBeNull();
    expect(negotiateContentCoding(undefined)).toBeNull();
  });

  it('only compresses textual/structured content types', () => {
    expect(isCompressibleContentType('application/json; charset=utf-8')).toBe(true);
    expect(isCompressibleContentType('application/problem+json')).toBe(true);
    expect(isCompressibleContentType('text/html')).toBe(true);
    expect(isCompressibleContentType('image/svg+xml')).toBe(true);
    expect(isCompressibleContentType('image/png')).toBe(false);
    expect(isCompressibleContentType('application/octet-stream')).toBe(false);
  });
});

describe('brotli-first response compression', () => {
  it('serves Brotli when the client accepts br', async () => {
    const response = await fetchRaw('/json', { 'Accept-Encoding': 'br' });

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBe('br');
    expect(String(response.headers.vary ?? '').toLowerCase()).toContain('accept-encoding');
    // Content-Length must describe the COMPRESSED bytes we actually sent.
    expect(Number(response.headers['content-length'])).toBe(response.body.length);
    expect(response.body.length).toBeLessThan(Buffer.byteLength(RAW_JSON));
    expect(zlib.brotliDecompressSync(response.body).toString()).toBe(RAW_JSON);
  });

  it('picks Brotli from a browser Accept-Encoding header', async () => {
    const response = await fetchRaw('/json', { 'Accept-Encoding': 'gzip, deflate, br, zstd' });

    expect(response.headers['content-encoding']).toBe('br');
    expect(JSON.parse(zlib.brotliDecompressSync(response.body).toString())).toEqual(LARGE_JSON);
  });

  it('falls back to gzip and deflate when Brotli is not accepted', async () => {
    const gzipped = await fetchRaw('/json', { 'Accept-Encoding': 'gzip' });
    expect(gzipped.headers['content-encoding']).toBe('gzip');
    expect(gzipped.body.length).toBeLessThan(Buffer.byteLength(RAW_JSON));
    expect(zlib.gunzipSync(gzipped.body).toString()).toBe(RAW_JSON);

    const deflated = await fetchRaw('/json', { 'Accept-Encoding': 'br;q=0, deflate' });
    expect(deflated.headers['content-encoding']).toBe('deflate');
    expect(zlib.inflateSync(deflated.body).toString()).toBe(RAW_JSON);
  });

  it('sends an uncompressed body when the client asks for none', async () => {
    const none = await fetchRaw('/json');
    expect(none.headers['content-encoding']).toBeUndefined();
    expect(none.body.toString()).toBe(RAW_JSON);

    const identity = await fetchRaw('/json', { 'Accept-Encoding': 'identity' });
    expect(identity.headers['content-encoding']).toBeUndefined();
    expect(identity.body.toString()).toBe(RAW_JSON);
  });

  it('skips small payloads, binary types and opt-outs', async () => {
    const small = await fetchRaw('/small', { 'Accept-Encoding': 'br' });
    expect(small.headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(small.body.toString())).toEqual({ ok: true });

    const binary = await fetchRaw('/binary', { 'Accept-Encoding': 'br' });
    expect(binary.headers['content-encoding']).toBeUndefined();
    expect(binary.body.length).toBe(4096);

    const noTransform = await fetchRaw('/no-transform', { 'Accept-Encoding': 'br' });
    expect(noTransform.headers['content-encoding']).toBeUndefined();
    expect(noTransform.body.toString()).toBe(RAW_JSON);

    const optOut = await fetchRaw('/opt-out', {
      'Accept-Encoding': 'br',
      'x-no-compression': '1',
    });
    expect(optOut.headers['content-encoding']).toBeUndefined();
    expect(optOut.body.toString()).toBe(RAW_JSON);
  });

  it('counts compressed responses and saved bytes in the metrics registry', async () => {
    await fetchRaw('/json', { 'Accept-Encoding': 'br' });

    const { metricsRegistry } = await import('../../src/observability/metrics');
    const metrics = await metricsRegistry.metrics();

    expect(metrics).toMatch(/http_responses_compressed_total\{encoding="br"\}\s+\d+/);
    expect(metrics).toMatch(/http_compression_saved_bytes_total\{encoding="br"\}\s+\d+/);
  });
});
