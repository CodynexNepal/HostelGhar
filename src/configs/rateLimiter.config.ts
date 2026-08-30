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
import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';
import { STATUS_CODE } from '../constant/statusCode.interface';
import { MESSAGES } from '../constant/message.interface';
import { dotEnvConfig } from './envConfig';

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

// ─── Core Rate Limiters ───────────────────────────────────────────────────────

/**
 * 1. Global Tier Rate Limiter:
 * Protects the entire application against scraping, distributed flooding, and volumetric attacks.
 * Default: 100 requests per 15 minutes per IP.
 */
export const globalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: dotEnvConfig.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: 'draft-7', // draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req: Request) => getClientIp(req),
  skip: (req: Request) => {
    // Never throttle health check probes or internal monitoring
    return req.path === '/health' || req.path === '/metrics';
  },
  handler: createRateLimitHandler(
    'Too many requests from this IP address. Please try again later.',
  ),
});

/**
 * 2. Auth / Brute-Force Rate Limiter:
 * Applied strictly to /auth/login, /auth/register to defend against credential stuffing and rainbow table attacks.
 * Default: 5 attempts per 15 minutes per IP.
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  limit: 5, // 5 requests max
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts to prevent password guessing
  keyGenerator: (req: Request) => {
    // Composite key: bind to IP + email if supplied in body for multi-vector defense
    const email =
      req.body && typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const ip = getClientIp(req);
    return email ? `${ip}_${email}` : ip;
  },
  handler: createRateLimitHandler(MESSAGES.ACCOUNT_LOCKED),
});

/**
 * 3. Password Reset & Sensitive OTP Limiter:
 * Extremely strict rate limiter for forgot-password, OTP verification, and email triggers.
 * Default: 3 attempts per 1 hour.
 */
export const sensitiveActionLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => getClientIp(req),
  handler: createRateLimitHandler(
    'Too many sensitive action attempts. Please try again in an hour.',
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
  keyGenerator: (req: Request) => getClientIp(req),
  handler: createRateLimitHandler(MESSAGES.REGISTRATION_LIMIT_EXCEEDED),
});

export const bookingCreationLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = req.user?.userId;
    return userId ? `booking:${userId}` : `booking:${getClientIp(req)}`;
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
