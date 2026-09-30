// ──────────────────────────────────────────────────────────────────────────────
// FILE: brotli.util.ts
// PURPOSE: Data (non-HTTP) Brotli compression built on the `brotli` npm package
//          (Emscripten port of the Brotli algorithm). Used for payloads stored in
//          Redis (L2 cache), BullMQ job data, and any large JSON blob where fewer
//          bytes = less bandwidth, less Redis memory, and lower latency on fetch.
//
// WHY THE `brotli` NPM PACKAGE HERE (AND NOT NATIVE `zlib`)?
//   - HTTP responses already use native async `zlib.brotliCompress` (see
//     `src/performance/http/compression.ts`) because it runs OFF the event loop
//     on the libuv threadpool — the lowest-latency choice per request.
//   - The `brotli` npm package is SYNCHRONOUS pure-JS/WASM. It blocks the event
//     loop while it runs, so it must never sit directly in the hot HTTP path.
//     It is ideal for background/offline work instead: cache writes, queue
//     payloads, import files — where a small one-time CPU cost buys bandwidth
//     and memory savings on every later read.
//   - This module keeps every operation safe: threshold + ratio guards mean we
//     only store the `br1:` form when it is actually smaller, and decode always
//     accepts legacy plain-JSON strings.
//
// WIRE FORMAT: `br1:<base64(brotli(json))>` — the `br1:` prefix lets decoders
// distinguish compressed rows from the plain JSON written before this landed.
// ──────────────────────────────────────────────────────────────────────────────

import * as brotli from 'brotli';

export interface BrotliDataOptions {
  /** 0 (fastest) - 11 (smallest). Default 4: low latency for cache/queue writes. */
  quality?: number;
  /** 0 = generic, 1 = text (UTF-8 JSON), 2 = font. Default 1. */
  mode?: 0 | 1 | 2;
  /** LZ window bits 10-24. Default 22 (upstream default). */
  lgwin?: number;
  /** Payloads smaller than this stay plain JSON. Default 1024 bytes. */
  thresholdBytes?: number;
}

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

const intFromEnv = (key: string, fallback: number): number => {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) ? Math.floor(raw) : fallback;
};

const boolFromEnv = (key: string, fallback: boolean): boolean => {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  return /^(?:1|true|yes|on)$/i.test(raw.trim());
};

/** Prefix marking a base64 Brotli payload. Bump if the format ever changes. */
export const BROTLI_PAYLOAD_PREFIX = 'br1:';

export interface ResolvedBrotliDataOptions {
  enabled: boolean;
  quality: number;
  mode: 0 | 1 | 2;
  lgwin: number;
  thresholdBytes: number;
}

/** Defaults resolved from the environment; overridable per call. */
export const resolveBrotliDataOptions = (
  overrides: BrotliDataOptions = {},
): ResolvedBrotliDataOptions => {
  const modeRaw = overrides.mode ?? intFromEnv('BROTLI_MODE', 1);
  const mode: 0 | 1 | 2 = modeRaw === 2 ? 2 : modeRaw === 0 ? 0 : 1;
  return {
    enabled: boolFromEnv('BROTLI_DATA_ENABLED', true),
    quality: clamp(overrides.quality ?? intFromEnv('BROTLI_QUALITY', 4), 0, 11),
    mode,
    lgwin: clamp(overrides.lgwin ?? intFromEnv('BROTLI_LGWIN', 22), 10, 24),
    thresholdBytes: Math.max(
      overrides.thresholdBytes ?? intFromEnv('BROTLI_THRESHOLD_BYTES', 1024),
      0,
    ),
  };
};

const toBuffer = (input: Buffer | Uint8Array | string): Buffer =>
  typeof input === 'string'
    ? Buffer.from(input, 'utf8')
    : Buffer.isBuffer(input)
      ? input
      : Buffer.from(input);

type BrotliQuality = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/**
 * Compresses a buffer with the `brotli` npm package (synchronous). Returns the
 * smaller of compressed / original — never inflates the payload.
 */
export const brotliCompressBuffer = (
  input: Buffer | Uint8Array | string,
  overrides: BrotliDataOptions = {},
): Buffer => {
  const options = resolveBrotliDataOptions(overrides);
  const source = toBuffer(input);
  if (source.length === 0) return source;
  const compressed = brotli.compress(source, {
    mode: options.mode,
    quality: options.quality as BrotliQuality,
    lgwin: options.lgwin,
  });
  if (!compressed) return source;
  const out = Buffer.from(compressed);
  return out.length < source.length ? out : source;
};

/** Decompresses a `brotli` npm payload back to its original bytes. */
export const brotliDecompressBuffer = (input: Buffer | Uint8Array): Buffer => {
  const source = toBuffer(input);
  return Buffer.from(brotli.decompress(source));
};

/**
 * Encodes any JSON-serialisable value for storage (Redis, queues).
 * Small or incompressible values stay plain JSON; larger values become
 * `br1:<base64>`. Never throws for serialisable input — on any compression
 * error the plain JSON is returned so callers never fail a request.
 */
export const encodeDataPayload = (data: unknown, overrides: BrotliDataOptions = {}): string => {
  const json = JSON.stringify(data);
  const options = resolveBrotliDataOptions(overrides);
  if (!options.enabled) return json;
  if (Buffer.byteLength(json, 'utf8') < options.thresholdBytes) return json;
  try {
    const compressed = brotli.compress(Buffer.from(json, 'utf8'), {
      mode: options.mode,
      quality: options.quality as BrotliQuality,
      lgwin: options.lgwin,
    });
    if (!compressed) return json;
    const candidate = `${BROTLI_PAYLOAD_PREFIX}${Buffer.from(compressed).toString('base64')}`;
    return candidate.length < json.length ? candidate : json;
  } catch {
    return json;
  }
};

/**
 * Decodes a string produced by `encodeDataPayload`. Accepts legacy plain JSON
 * (no prefix) so rows written before Brotli keep working during rollout.
 */
export const decodeDataPayload = <T = unknown>(stored: string): T => {
  if (stored.startsWith(BROTLI_PAYLOAD_PREFIX)) {
    const compressed = Buffer.from(stored.slice(BROTLI_PAYLOAD_PREFIX.length), 'base64');
    const raw = Buffer.from(brotli.decompress(compressed)).toString('utf8');
    return JSON.parse(raw) as T;
  }
  return JSON.parse(stored) as T;
};

/** True when the stored string is a Brotli (`br1:`) payload. */
export const isBrotliPayload = (stored: string): boolean =>
  stored.startsWith(BROTLI_PAYLOAD_PREFIX);

// ─── BullMQ queue payload compression ────────────────────────────────────────
// The resident CSV import enqueues up to 2,000 parsed rows as one BullMQ job —
// the only producer write large enough to matter (emails/notifications/audit
// events are a few hundred bytes). Packing just the `rows` array keeps job
// metadata (importId/hostelId/...) plain JSON for BullMQ dashboards/retries,
// while the bulky rows ride as one `br1:` string — less Redis memory +
// bandwidth on every enqueue, retry, and worker fetch. `unpackQueueRows`
// accepts legacy jobs whose `rows` is still a plain array, so in-flight jobs
// queued before this deploys keep processing after a rolling restart.

/** Per-call overrides for {@link packQueueRows}; same knobs as data payloads. */
export type QueueRowsPackOptions = BrotliDataOptions;

/**
 * Packs a BullMQ job payload's large `rows` array into a `br1:` string when it
 * saves bytes; returns the payload unchanged otherwise. Never throws — on any
 * error the original payload is returned so enqueueing never fails.
 */
export const packQueueRows = <T extends { rows: R[] }, R>(
  payload: T,
  overrides: QueueRowsPackOptions = {},
): T & { rowsBr?: string } => {
  try {
    const json = JSON.stringify(payload.rows);
    const options = resolveBrotliDataOptions(overrides);
    if (!options.enabled || Buffer.byteLength(json, 'utf8') < options.thresholdBytes) {
      return payload;
    }
    const compressed = brotli.compress(Buffer.from(json, 'utf8'), {
      mode: options.mode,
      quality: options.quality as BrotliQuality,
      lgwin: options.lgwin,
    });
    if (!compressed) return payload;
    const candidate = `${BROTLI_PAYLOAD_PREFIX}${Buffer.from(compressed).toString('base64')}`;
    if (candidate.length >= json.length) return payload;
    const { rows: _dropped, ...rest } = payload as T & { rows: R[] };
    void _dropped;
    return { ...(rest as unknown as T), rows: [], rowsBr: candidate };
  } catch {
    return payload;
  }
};

/**
 * Restores `rows` packed by `packQueueRows`. Accepts legacy payloads (plain
 * `rows` array, no `rowsBr`) unchanged, so jobs enqueued before compression
 * landed — or with compression disabled — decode identically.
 */
export const unpackQueueRows = <
  T extends { rows?: R[] | undefined; rowsBr?: string | undefined },
  R,
>(
  payload: T,
): Omit<T, 'rowsBr'> & { rows: R[] } => {
  const { rowsBr, ...rest } = payload;
  if (typeof rowsBr !== 'string' || rowsBr.length === 0) {
    return { ...rest, rows: (payload.rows ?? []) as R[] } as Omit<T, 'rowsBr'> & { rows: R[] };
  }
  if (!rowsBr.startsWith(BROTLI_PAYLOAD_PREFIX)) {
    return { ...rest, rows: (payload.rows ?? []) as R[] } as Omit<T, 'rowsBr'> & { rows: R[] };
  }
  const compressed = Buffer.from(rowsBr.slice(BROTLI_PAYLOAD_PREFIX.length), 'base64');
  const rows = JSON.parse(Buffer.from(brotli.decompress(compressed)).toString('utf8')) as R[];
  const { rows: _legacy, ...clean } = rest as { rows?: R[] } & Record<string, unknown>;
  void _legacy;
  return { ...(clean as unknown as Omit<T, 'rowsBr'>), rows };
};
