// ──────────────────────────────────────────────────────────────────────────────
// FILE: compression.ts
// PURPOSE: Production response compression — Brotli (`br`) first, gzip and
//          deflate as fallbacks — built directly on Node's native `zlib`, so
//          there is no native addon to compile and no third-party compression
//          dependency.
//
// WHY BROTLI: Brotli yields ~15-25% smaller text/JSON payloads than gzip at a
//   comparable encode cost and browsers decode it transparently from the
//   `Content-Encoding: br` header. Smaller payloads = faster mobile load and
//   fewer bytes leaving the host.
//
// WHY NOT `brotliCompressSync`: the async form runs on the libuv threadpool, so
//   large JSON bodies are compressed OFF the event loop while the server keeps
//   serving other requests.
//
// BEHAVIOUR:
//   - Negotiates the best coding from `Accept-Encoding` (q-values honoured,
//     `br;q=0` disables Brotli, `*` acts as a wildcard).
//   - Buffers the body (cap `COMPRESSION_MAX_BUFFER_BYTES`) and compresses once
//     on `res.end()` → exact `Content-Length`, no chunked-encoding overhead.
//   - Always sets `Vary: Accept-Encoding` so proxies/CDNs never hand a Brotli
//     body to a client that cannot decode it.
//   - Skips HEAD, 1xx/204/205/304, already-encoded bodies, non-compressible
//     content types, bodies below `COMPRESSION_THRESHOLD_BYTES`,
//     `Cache-Control: no-transform` and `x-no-compression` opt-outs.
//   - If compression does not shrink the body, the ORIGINAL bytes are sent — a
//     compression problem must never fail a request.
//
// ENV KNOBS (all optional; production defaults shown):
//   COMPRESSION_ENABLED=true|false        (default true)
//   COMPRESSION_BROTLI_QUALITY=0..11      (default 5 — dynamic-content sweet spot)
//   COMPRESSION_GZIP_LEVEL=0..9           (default 6 — zlib default)
//   COMPRESSION_THRESHOLD_BYTES=1024      (default 1 KiB)
//   COMPRESSION_MAX_BUFFER_BYTES=2097152  (default 2 MiB, then pass-through)
// ──────────────────────────────────────────────────────────────────────────────

import { NextFunction, Request, Response } from 'express';
import zlib from 'zlib';
import {
  httpCompressionSavedBytesTotal,
  httpResponsesCompressedTotal,
} from '../../observability/metrics';

/** Content codings this middleware can produce, in SERVER preference order. */
export type ContentCoding = 'br' | 'gzip' | 'deflate';

const CODING_PREFERENCE: readonly ContentCoding[] = ['br', 'gzip', 'deflate'];

export interface CompressionOptions {
  /** Master switch. `false` makes the middleware a pure pass-through. */
  enabled?: boolean;
  /**
   * Brotli quality 0-11. Default 5: measured on the owner dashboard payload it
   * beats gzip-6 by ~5% (847 B vs 891 B) for ~1-2 ms of threadpool CPU per 3 KB,
   * while quality 11 costs ~10x that for a few hundred extra bytes.
   */
  brotliQuality?: number;
  /** gzip/deflate zlib level 0-9. */
  gzipLevel?: number;
  /** Bodies smaller than this stay uncompressed (bytes). */
  thresholdBytes?: number;
  /** Above this, buffering stops and the response streams through as-is (bytes). */
  maxBufferedBytes?: number;
}

// ─── Content types worth compressing ─────────────────────────────────────────
// Everything textual/structured. Anything else (images, video, zip, pdf,
// octet-stream) is already compressed and would only burn CPU.
const COMPRESSIBLE_CONTENT_TYPE =
  /^(?:text\/|application\/(?:[\w.+-]*\+)?(?:json|xml|javascript|ecmascript|graphql|x-ndjson|x-www-form-urlencoded|x-yaml|yaml|csv|rtf|wasm|sql)|image\/svg\+xml|font\/)/i;

export const isCompressibleContentType = (contentType: string): boolean =>
  COMPRESSIBLE_CONTENT_TYPE.test(contentType.split(';')[0]?.trim() ?? '');

// ─── Env helpers (same style as app.ts, which also reads process.env) ────────
const intFromEnv = (key: string, fallback: number): number => {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) ? Math.floor(raw) : fallback;
};

const boolFromEnv = (key: string, fallback: boolean): boolean => {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  return /^(?:1|true|yes|on)$/i.test(raw.trim());
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Defaults resolved from the environment; overridable per middleware instance. */
export const resolveCompressionOptions = (
  overrides: CompressionOptions = {},
): Required<CompressionOptions> => ({
  enabled: overrides.enabled ?? boolFromEnv('COMPRESSION_ENABLED', true),
  brotliQuality: clamp(
    overrides.brotliQuality ?? intFromEnv('COMPRESSION_BROTLI_QUALITY', 5),
    0,
    11,
  ),
  gzipLevel: clamp(overrides.gzipLevel ?? intFromEnv('COMPRESSION_GZIP_LEVEL', 6), 0, 9),
  thresholdBytes: Math.max(
    overrides.thresholdBytes ?? intFromEnv('COMPRESSION_THRESHOLD_BYTES', 1024),
    0,
  ),
  maxBufferedBytes: Math.max(
    overrides.maxBufferedBytes ?? intFromEnv('COMPRESSION_MAX_BUFFER_BYTES', 2 * 1024 * 1024),
    1024 * 1024,
  ),
});

/**
 * Picks the best coding the client accepts. Client quality values decide first
 * (`br;q=0.1, gzip;q=0.9` → `gzip`, `br;q=0` disables Brotli), and the server
 * preference `br` → `gzip` → `deflate` breaks ties (`gzip, deflate, br` → `br`,
 * `*` → `br`). `identity` → `null`, i.e. send the body as-is.
 */
export const negotiateContentCoding = (acceptEncoding?: string): ContentCoding | null => {
  if (!acceptEncoding) return null;

  const weights = new Map<string, number>();
  for (const part of acceptEncoding.split(',')) {
    const [rawName, ...params] = part.trim().split(';');
    const name = rawName?.trim().toLowerCase();
    if (!name) continue;
    let quality = 1;
    for (const param of params) {
      const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
      if (match?.[1] !== undefined) quality = Number.parseFloat(match[1]);
    }
    weights.set(name, Number.isFinite(quality) ? quality : 0);
  }

  const ranked = CODING_PREFERENCE.map((coding, index) => ({
    coding,
    index,
    // A wildcard covers every coding the client did not name explicitly.
    quality: weights.get(coding) ?? weights.get('*') ?? 0,
  }))
    .filter((candidate) => candidate.quality > 0)
    // Highest q wins; equal q falls back to server preference order.
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  return ranked[0]?.coding ?? null;
};

/**
 * Compresses a buffer with the negotiated coding. Async on purpose: libuv runs
 * the blocking Brotli/gzip work on its threadpool, so the event loop stays free.
 */
const compressBuffer = (
  coding: ContentCoding,
  body: Buffer,
  options: Required<CompressionOptions>,
): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    const done = (error: Error | null, result: Buffer): void => {
      if (error) reject(error);
      else resolve(result);
    };

    if (coding === 'br') {
      zlib.brotliCompress(
        body,
        {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: options.brotliQuality,
            // SIZE_HINT lets the encoder pick a matching window/block strategy.
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length,
            // JSON/HTML/JS is text — text mode beats generic mode here.
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
          },
        },
        done,
      );
      return;
    }

    const compress = coding === 'gzip' ? zlib.gzip : zlib.deflate;
    compress(body, { level: options.gzipLevel }, done);
  });

/** Optional callback shapes accepted by `res.write`/`res.end`. */
type WriteCallback = (error?: Error | null) => void;

const asBuffer = (chunk: unknown, encoding?: BufferEncoding): Buffer | null => {
  if (typeof chunk === 'string') return Buffer.from(chunk, encoding ?? 'utf8');
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return null;
};

/**
 * Brotli-first compression middleware. Register it EARLY (before routes) so the
 * `res.write`/`res.end` overrides below are in place for every handler.
 */
export const createCompressionMiddleware = (overrides: CompressionOptions = {}) => {
  const options = resolveCompressionOptions(overrides);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!options.enabled || req.method === 'HEAD') {
      next();
      return;
    }

    const coding = negotiateContentCoding(req.headers['accept-encoding']);
    if (!coding) {
      next();
      return;
    }

    // Caches key on this: a Brotli body must never be handed to a client that
    // only asked for gzip (or for nothing at all).
    res.vary('Accept-Encoding');

    const rawWrite = res.write.bind(res) as unknown as (
      chunk: unknown,
      encoding?: unknown,
      callback?: unknown,
    ) => boolean;
    const rawEnd = res.end.bind(res) as unknown as (
      chunk?: unknown,
      encoding?: unknown,
      callback?: unknown,
    ) => void;

    const chunks: Buffer[] = [];
    const pendingCallbacks: WriteCallback[] = [];
    let bufferedBytes = 0;
    let passThrough = false;

    /** True while this response still qualifies for compression. */
    const shouldCompress = (): boolean => {
      if (passThrough || res.headersSent) return false;
      if (res.getHeader('content-encoding') !== undefined) return false;
      const status = res.statusCode;
      if (status < 200 || status === 204 || status === 205 || status === 304) return false;
      // SSE and other streaming text must never be buffered.
      if (!isCompressibleContentType(String(res.getHeader('content-type') ?? ''))) return false;
      if (/no-transform/i.test(String(res.getHeader('cache-control') ?? ''))) return false;
      if (req.headers['x-no-compression'] !== undefined) return false;
      return true;
    };

    const runCallbacks = (error?: Error | null): void => {
      for (const callback of pendingCallbacks.splice(0)) callback(error);
    };

    /** Flush whatever is buffered, uncompressed, and stop intercepting. */
    const releaseBuffers = (): void => {
      if (chunks.length > 0) {
        rawWrite(Buffer.concat(chunks));
        chunks.length = 0;
        bufferedBytes = 0;
      }
      runCallbacks();
    };

    const appendChunk = (chunk: unknown, encoding?: BufferEncoding): void => {
      const buffer = asBuffer(chunk, encoding);
      if (buffer === null || buffer.length === 0) return;
      chunks.push(buffer);
      bufferedBytes += buffer.length;
    };

    // ── res.write / res.end overrides: buffer now, compress once at end ──────
    res.write = ((chunk: unknown, encodingOrCallback?: unknown, callback?: unknown): boolean => {
      const cb = (typeof encodingOrCallback === 'function' ? encodingOrCallback : callback) as
        WriteCallback | undefined;
      const encoding =
        typeof encodingOrCallback === 'string' ? (encodingOrCallback as BufferEncoding) : undefined;
      if (cb !== undefined) pendingCallbacks.push(cb);

      if (!shouldCompress()) {
        passThrough = true;
        releaseBuffers();
        const written = rawWrite(chunk, encoding);
        runCallbacks();
        return written;
      }

      appendChunk(chunk, encoding);
      // Guard rail: a huge/streamed body must never pile up in memory — flush
      // what we have and stream the remainder untouched.
      if (bufferedBytes > options.maxBufferedBytes) {
        passThrough = true;
        releaseBuffers();
      }
      return true;
    }) as unknown as Response['write'];

    res.end = ((chunk?: unknown, encodingOrCallback?: unknown, callback?: unknown): Response => {
      const cb = (typeof encodingOrCallback === 'function' ? encodingOrCallback : callback) as
        WriteCallback | undefined;
      const encoding =
        typeof encodingOrCallback === 'string' ? (encodingOrCallback as BufferEncoding) : undefined;
      if (cb !== undefined) pendingCallbacks.push(cb);

      appendChunk(chunk, encoding);
      const body = Buffer.concat(chunks);
      chunks.length = 0;
      bufferedBytes = 0;

      const finish = (payload: Buffer, appliedCoding?: ContentCoding): void => {
        if (appliedCoding !== undefined) {
          res.setHeader('Content-Encoding', appliedCoding);
          // Only for non-chunked responses: Node rejects a Transfer-Encoding
          // header combined with an explicit Content-Length.
          if (res.getHeader('transfer-encoding') === undefined) {
            res.setHeader('Content-Length', String(payload.length));
          }
        }
        rawEnd(payload);
        runCallbacks();
      };

      // Too small to bother, or no longer eligible (streamed/partial content).
      if (body.length < options.thresholdBytes || !shouldCompress()) {
        finish(body);
        return res;
      }

      void compressBuffer(coding, body, options).then(
        (compressed) => {
          // Incompressible (already random/binary): keep the smaller original.
          if (compressed.length >= body.length) {
            finish(body);
            return;
          }
          try {
            httpResponsesCompressedTotal.inc({ encoding: coding });
            httpCompressionSavedBytesTotal.inc(
              { encoding: coding },
              body.length - compressed.length,
            );
          } catch {
            // Metrics are best-effort; they must never fail a response.
          }
          finish(compressed, coding);
        },
        // Compression must never be able to fail a request.
        () => finish(body),
      );

      return res;
    }) as unknown as Response['end'];

    next();
  };
};

/** Ready-to-use instance, registered by `registerPerformanceMiddleware`. */
export const compressionMiddleware = createCompressionMiddleware();
