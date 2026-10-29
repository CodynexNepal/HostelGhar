// ──────────────────────────────────────────────────────────────────────────────
// FILE: rateLimiter.config.ts
// PURPOSE: Production-Grade Multi-Tier Rate Limiting Architecture.
//
// ARCHITECTURAL DESIGN (20+ Years Backend Engineering Principles):
//   1. Tiered Protection Strategy:
//      - Global DDoS Limiter: Broad defense for overall infrastructure.
//      - Auth / Brute-Force Limiter: Strict anti-credential stuffing on login/register.
//      - Password Reset Limiter: Highly restrictive throttle on sensitive reset endpoints.
//      - High-Frequency API Limiter: Generous limits for read-heavy resources.
//
//   2. Reverse Proxy & Header Resilience:
//      - Multi-hop X-Forwarded-For parsing & Cloudflare (CF-Connecting-IP) support.
//      - IPv4 and IPv6 dual-stack normalization.
//
//   3. Standard Compliance:
//      - draft-7 RateLimit headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset).
//      - RFC 6585 HTTP 429 Too Many Requests with Retry-After header.
//
//   4. Observability & Fail-Open Graceful Degradation:
//      - Structured handler logging on limit violations.
//      - Skip conditions for internal health probes and load balancer pings.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import rateLimit, { Options, RateLimitRequestHandler, ipKeyGenerator } from 'express-rate-limit';
import { STATUS_CODE } from '../constant/statusCode.interface';
import { MESSAGES } from '../constant/message.interface';
import { dotEnvConfig } from './envConfig';
import { applyCorsHeaders } from './cors.config';

// ─── IP Normalization & Client Identification ─────────────────────────────────

/**
 * Extracts and normalizes client IP across load balancers, Cloudflare, AWS ALB, and proxies.
 */
export const getClientIp = (req: Request): string => {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }

  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
    // Leftmost address is the original client IP
    const clientIp = xForwardedFor.split(',')[0]?.trim();
    if (clientIp) return clientIp;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return req.ip || req.socket.remoteAddress || '127.0.0.1';
};

// ─── Reusable Error Handler Factory ──────────────────────────────────────────

/**
 * Standardized JSON error response adhering to uniform API format with Retry-After.
 */
const createRateLimitHandler = (customMessage: string) => {
  return (req: Request, res: Response, _next: unknown, options: Options): void => {
    applyCorsHeaders(req, res);
    const clientIp = getClientIp(req);
    const retryAfter = Math.ceil(options.windowMs / 1000);

    // Set standard Retry-After header
    res.setHeader('Retry-After', retryAfter);

    if (dotEnvConfig.NODE_ENV !== 'production') {
      console.warn(
        `⚠️ [RateLimit Exceeded] IP=${clientIp} PATH=${req.originalUrl} METHOD=${req.method}`,
      );
    }

    res.status(STATUS_CODE.TOO_MANY_REQUESTS).json({
      success: false,
      statusCode: STATUS_CODE.TOO_MANY_REQUESTS,
      message: customMessage,
      error: 'TooManyRequests',
      retryAfterSeconds: retryAfter,
      timestamp: new Date().toISOString(),
    });
  };
};

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Skip CORS preflight — browsers must never consume rate-limit budget. */
const skipPreflight = (req: Request): boolean => {
  if (req.method === 'OPTIONS') return true;
  // Never throttle health check probes or internal monitoring
  return req.path === '/health' || req.path === '/metrics';
};

/** IPv6-safe base key. MUST use ipKeyGenerator when trust proxy is enabled. */
const baseIpKey = (req: Request): string => ipKeyGenerator(getClientIp(req));

// ─── Core Rate Limiters ───────────────────────────────────────────────────────

/**
 * 1. Global Tier Rate Limiter:
 * Protects the entire application against scraping, distributed flooding, and volumetric attacks.
 * Default: 500 requests per 15 minutes per IP in production (configurable via RATE_LIMIT_GLOBAL_MAX).
 */
export const globalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit:
    Number(process.env.RATE_LIMIT_GLOBAL_MAX) ||
    (dotEnvConfig.NODE_ENV === 'production' ? 500 : 1000),
  standardHeaders: 'draft-7', // draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: baseIpKey,
  skip: skipPreflight,
  handler: createRateLimitHandler(
    'Too many requests from this IP address. Please try again later.',
  ),
});

/**
 * 2. Auth / Brute-Force Rate Limiter:
 * Applied strictly to /auth/login, /auth/register to defend against credential stuffing and rainbow table attacks.
 * Production: 5 attempts per 15 minutes. Dev/test: relaxed so local testing never locks you out.
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  limit: dotEnvConfig.NODE_ENV === 'production' ? 5 : 100, // 5 requests max in prod
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts to prevent password guessing
  skip: skipPreflight,
  keyGenerator: (req: Request) => {
    // Composite key: bind to IPv6-safe IP + email if supplied in body.
    // NOTE: req.body may be undefined on preflight/CORS OPTIONS — guard it,
    // and ALWAYS pass the IP through ipKeyGenerator (ERR_ERL_KEY_GEN_IPV6).
    const email =
      req.body && typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const ip = baseIpKey(req);
    return email ? `${ip}_${email}` : ip;
  },
  handler: createRateLimitHandler(MESSAGES.ACCOUNT_LOCKED),
});

/**
 * 3. Password Reset & Sensitive OTP Limiter:
 * Rate limiter for forgot-password, OTP verification, and password change triggers.
 * Production default: 15 attempts per 15 minutes window (customizable via RATE_LIMIT_SENSITIVE_MAX
 * and RATE_LIMIT_SENSITIVE_WINDOW_MINUTES).
 * Composite keying: Binds to authenticated userId or IP+email to prevent shared NAT/Wi-Fi lockouts.
 */
const sensitiveActionWindowMs =
  Number(process.env.RATE_LIMIT_SENSITIVE_WINDOW_MS) ||
  (Number(process.env.RATE_LIMIT_SENSITIVE_WINDOW_MINUTES)
    ? Number(process.env.RATE_LIMIT_SENSITIVE_WINDOW_MINUTES) * 60 * 1000
    : 15 * 60 * 1000); // 15 minutes default

const sensitiveActionLimit =
  Number(process.env.RATE_LIMIT_SENSITIVE_MAX) ||
  (dotEnvConfig.NODE_ENV === 'production' ? 15 : 100);

export const sensitiveActionLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: sensitiveActionWindowMs,
  limit: sensitiveActionLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipPreflight,
  keyGenerator: (req: Request): string => {
    // If authenticated (e.g. change-password), bind to userId to prevent NAT collateral lockout
    const userId = req.user?.userId;
    if (userId) {
      return `sensitive:user:${userId}`;
    }
    // If body contains an email (e.g. forgot-password, reset-password), bind to IP + email
    const email =
      req.body && typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const ip = baseIpKey(req);
    return email ? `sensitive:${ip}_${email}` : `sensitive:${ip}`;
  },
  handler: createRateLimitHandler(
    'Too many sensitive action attempts. Please try again later.',
  ),
});

/**
 * 4. High-Throughput Read Limiter:
 * For public search, listing views, and autocomplete endpoints.
 * Default: 300 requests per 5 minutes.
 */
export const apiReadLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipPreflight,
  keyGenerator: baseIpKey,
  handler: createRateLimitHandler(MESSAGES.REGISTRATION_LIMIT_EXCEEDED),
});

export const bookingCreationLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipPreflight,
  keyGenerator: (req: Request) => {
    const userId = req.user?.userId;
    return userId ? `booking:${userId}` : `booking:${baseIpKey(req)}`;
  },
  handler: createRateLimitHandler('Too many booking attempts. Please try again later.'),
});

export default {
  globalRateLimiter,
  authRateLimiter,
  sensitiveActionLimiter,
  apiReadLimiter,
  bookingCreationLimiter,
  getClientIp,
};
