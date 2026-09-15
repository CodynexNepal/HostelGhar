import { CorsOptions } from 'cors';
import { dotEnvConfig } from './envConfig';

/**
 * Normalizes a single origin: trims whitespace and strips trailing slashes
 * so `http://localhost:5173/` matches `http://localhost:5173`.
 */
const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, '');

const parseOrigins = (value: string): string[] => {
  if (!value || value.trim() === '' || value.trim() === '*') {
    return [];
  }

  return value.split(',').map(normalizeOrigin).filter(Boolean);
};

const allowedOrigins = parseOrigins(dotEnvConfig.CORS_ORIGIN);
const isDev = dotEnvConfig.NODE_ENV !== 'production';

if (!isDev && allowedOrigins.length === 0) {
  throw new Error('CORS_ORIGIN must contain an explicit production origin allowlist.');
}

export const corsConfig: CorsOptions = {
  // Function form: exact-match normalized origins; permissive in dev so a
  // mismatched FRONTEND_URL can NEVER cause a hanging preflight again.
  // `!origin` (same-origin / curl / Postman) is always allowed.
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    const normalized = normalizeOrigin(origin);
    if (isDev && allowedOrigins.length === 0) {
      // CORS_ORIGIN='*' or unset — reflect the requesting origin.
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(normalized)) {
      callback(null, true);
      return;
    }
    if (isDev) {
      // Fail-open in dev with a loud warning instead of a silent hang.
      console.warn(`[CORS] Allowing unlisted dev origin: ${origin}`);
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  // Must answer preflight with 204 (some browsers choke on 200 + body).
  optionsSuccessStatus: 204,
  preflightContinue: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token',
    // Custom headers actually used by this API / frontend.
    // If ANY of these is missing, the browser passes the OPTIONS (server
    // still logs 204) but then BLOCKS the real GET/POST with:
    // "Request header field x-... is not allowed by Access-Control-Allow-Headers"
    // — which is exactly "only OPTIONS, no GET" in your logs.
    'X-Hostel-Id',
    'X-Request-Id',
    'Cache-Control',
    'Pragma',
    'Expires',
    'If-None-Match',
    'If-Modified-Since',
  ],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
  maxAge: 86400, // cache preflight for 24h — fewer OPTIONS round-trips
};
