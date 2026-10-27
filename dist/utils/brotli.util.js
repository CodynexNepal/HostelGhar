"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.unpackQueueRows = exports.packQueueRows = exports.isBrotliPayload = exports.decodeDataPayload = exports.encodeDataPayload = exports.brotliDecompressBuffer = exports.brotliCompressBuffer = exports.resolveBrotliDataOptions = exports.BROTLI_PAYLOAD_PREFIX = void 0;
const brotli = __importStar(require("brotli"));
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const intFromEnv = (key, fallback) => {
    const raw = Number(process.env[key]);
    return Number.isFinite(raw) ? Math.floor(raw) : fallback;
};
const boolFromEnv = (key, fallback) => {
    const raw = process.env[key];
    if (raw === undefined || raw.trim() === '')
        return fallback;
    return /^(?:1|true|yes|on)$/i.test(raw.trim());
};
/** Prefix marking a base64 Brotli payload. Bump if the format ever changes. */
exports.BROTLI_PAYLOAD_PREFIX = 'br1:';
/** Defaults resolved from the environment; overridable per call. */
const resolveBrotliDataOptions = (overrides = {}) => {
    const modeRaw = overrides.mode ?? intFromEnv('BROTLI_MODE', 1);
    const mode = modeRaw === 2 ? 2 : modeRaw === 0 ? 0 : 1;
    return {
        enabled: boolFromEnv('BROTLI_DATA_ENABLED', true),
        quality: clamp(overrides.quality ?? intFromEnv('BROTLI_QUALITY', 4), 0, 11),
        mode,
        lgwin: clamp(overrides.lgwin ?? intFromEnv('BROTLI_LGWIN', 22), 10, 24),
        thresholdBytes: Math.max(overrides.thresholdBytes ?? intFromEnv('BROTLI_THRESHOLD_BYTES', 1024), 0),
    };
};
exports.resolveBrotliDataOptions = resolveBrotliDataOptions;
const toBuffer = (input) => typeof input === 'string'
    ? Buffer.from(input, 'utf8')
    : Buffer.isBuffer(input)
        ? input
        : Buffer.from(input);
/**
 * Compresses a buffer with the `brotli` npm package (synchronous). Returns the
 * smaller of compressed / original — never inflates the payload.
 */
const brotliCompressBuffer = (input, overrides = {}) => {
    const options = (0, exports.resolveBrotliDataOptions)(overrides);
    const source = toBuffer(input);
    if (source.length === 0)
        return source;
    const compressed = brotli.compress(source, {
        mode: options.mode,
        quality: options.quality,
        lgwin: options.lgwin,
    });
    if (!compressed)
        return source;
    const out = Buffer.from(compressed);
    return out.length < source.length ? out : source;
};
exports.brotliCompressBuffer = brotliCompressBuffer;
/** Decompresses a `brotli` npm payload back to its original bytes. */
const brotliDecompressBuffer = (input) => {
    const source = toBuffer(input);
    return Buffer.from(brotli.decompress(source));
};
exports.brotliDecompressBuffer = brotliDecompressBuffer;
/**
 * Encodes any JSON-serialisable value for storage (Redis, queues).
 * Small or incompressible values stay plain JSON; larger values become
 * `br1:<base64>`. Never throws for serialisable input — on any compression
 * error the plain JSON is returned so callers never fail a request.
 */
const encodeDataPayload = (data, overrides = {}) => {
    const json = JSON.stringify(data);
    const options = (0, exports.resolveBrotliDataOptions)(overrides);
    if (!options.enabled)
        return json;
    if (Buffer.byteLength(json, 'utf8') < options.thresholdBytes)
        return json;
    try {
        const compressed = brotli.compress(Buffer.from(json, 'utf8'), {
            mode: options.mode,
            quality: options.quality,
            lgwin: options.lgwin,
        });
        if (!compressed)
            return json;
        const candidate = `${exports.BROTLI_PAYLOAD_PREFIX}${Buffer.from(compressed).toString('base64')}`;
        return candidate.length < json.length ? candidate : json;
    }
    catch {
        return json;
    }
};
exports.encodeDataPayload = encodeDataPayload;
/**
 * Decodes a string produced by `encodeDataPayload`. Accepts legacy plain JSON
 * (no prefix) so rows written before Brotli keep working during rollout.
 */
const decodeDataPayload = (stored) => {
    if (stored.startsWith(exports.BROTLI_PAYLOAD_PREFIX)) {
        const compressed = Buffer.from(stored.slice(exports.BROTLI_PAYLOAD_PREFIX.length), 'base64');
        const raw = Buffer.from(brotli.decompress(compressed)).toString('utf8');
        return JSON.parse(raw);
    }
    return JSON.parse(stored);
};
exports.decodeDataPayload = decodeDataPayload;
/** True when the stored string is a Brotli (`br1:`) payload. */
const isBrotliPayload = (stored) => stored.startsWith(exports.BROTLI_PAYLOAD_PREFIX);
exports.isBrotliPayload = isBrotliPayload;
/**
 * Packs a BullMQ job payload's large `rows` array into a `br1:` string when it
 * saves bytes; returns the payload unchanged otherwise. Never throws — on any
 * error the original payload is returned so enqueueing never fails.
 */
const packQueueRows = (payload, overrides = {}) => {
    try {
        const json = JSON.stringify(payload.rows);
        const options = (0, exports.resolveBrotliDataOptions)(overrides);
        if (!options.enabled || Buffer.byteLength(json, 'utf8') < options.thresholdBytes) {
            return payload;
        }
        const compressed = brotli.compress(Buffer.from(json, 'utf8'), {
            mode: options.mode,
            quality: options.quality,
            lgwin: options.lgwin,
        });
        if (!compressed)
            return payload;
        const candidate = `${exports.BROTLI_PAYLOAD_PREFIX}${Buffer.from(compressed).toString('base64')}`;
        if (candidate.length >= json.length)
            return payload;
        const { rows: _dropped, ...rest } = payload;
        void _dropped;
        return { ...rest, rows: [], rowsBr: candidate };
    }
    catch {
        return payload;
    }
};
exports.packQueueRows = packQueueRows;
/**
 * Restores `rows` packed by `packQueueRows`. Accepts legacy payloads (plain
 * `rows` array, no `rowsBr`) unchanged, so jobs enqueued before compression
 * landed — or with compression disabled — decode identically.
 */
const unpackQueueRows = (payload) => {
    const { rowsBr, ...rest } = payload;
    if (typeof rowsBr !== 'string' || rowsBr.length === 0) {
        return { ...rest, rows: (payload.rows ?? []) };
    }
    if (!rowsBr.startsWith(exports.BROTLI_PAYLOAD_PREFIX)) {
        return { ...rest, rows: (payload.rows ?? []) };
    }
    const compressed = Buffer.from(rowsBr.slice(exports.BROTLI_PAYLOAD_PREFIX.length), 'base64');
    const rows = JSON.parse(Buffer.from(brotli.decompress(compressed)).toString('utf8'));
    const { rows: _legacy, ...clean } = rest;
    void _legacy;
    return { ...clean, rows };
};
exports.unpackQueueRows = unpackQueueRows;
