"use strict";
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
exports.bookingCreationLimiter = exports.apiReadLimiter = exports.sensitiveActionLimiter = exports.authRateLimiter = exports.globalRateLimiter = exports.getClientIp = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const statusCode_interface_1 = require("../constant/statusCode.interface");
const message_interface_1 = require("../constant/message.interface");
const envConfig_1 = require("./envConfig");
const cors_config_1 = require("./cors.config");
// ─── IP Normalization & Client Identification ─────────────────────────────────
/**
 * Extracts and normalizes client IP across load balancers, Cloudflare, AWS ALB, and proxies.
 */
const getClientIp = (req) => {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) {
        return cfIp.trim();
    }
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
        // Leftmost address is the original client IP
        const clientIp = xForwardedFor.split(',')[0]?.trim();
        if (clientIp)
            return clientIp;
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
        return realIp.trim();
    }
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
};
exports.getClientIp = getClientIp;
// ─── Reusable Error Handler Factory ──────────────────────────────────────────
/**
 * Standardized JSON error response adhering to uniform API format with Retry-After.
 */
const createRateLimitHandler = (customMessage) => {
    return (req, res, _next, options) => {
        (0, cors_config_1.applyCorsHeaders)(req, res);
        const clientIp = (0, exports.getClientIp)(req);
        const retryAfter = Math.ceil(options.windowMs / 1000);
        // Set standard Retry-After header
        res.setHeader('Retry-After', retryAfter);
        if (envConfig_1.dotEnvConfig.NODE_ENV !== 'production') {
            console.warn(`⚠️ [RateLimit Exceeded] IP=${clientIp} PATH=${req.originalUrl} METHOD=${req.method}`);
        }
        res.status(statusCode_interface_1.STATUS_CODE.TOO_MANY_REQUESTS).json({
            success: false,
            statusCode: statusCode_interface_1.STATUS_CODE.TOO_MANY_REQUESTS,
            message: customMessage,
            error: 'TooManyRequests',
            retryAfterSeconds: retryAfter,
            timestamp: new Date().toISOString(),
        });
    };
};
// ─── Shared helpers ──────────────────────────────────────────────────────────
/** Skip CORS preflight — browsers must never consume rate-limit budget. */
const skipPreflight = (req) => {
    if (req.method === 'OPTIONS')
        return true;
    // Never throttle health check probes or internal monitoring
    return req.path === '/health' || req.path === '/metrics';
};
/** IPv6-safe base key. MUST use ipKeyGenerator when trust proxy is enabled. */
const baseIpKey = (req) => (0, express_rate_limit_1.ipKeyGenerator)((0, exports.getClientIp)(req));
// ─── Core Rate Limiters ───────────────────────────────────────────────────────
/**
 * 1. Global Tier Rate Limiter:
 * Protects the entire application against scraping, distributed flooding, and volumetric attacks.
 * Default: 100 requests per 15 minutes per IP.
 */
exports.globalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: envConfig_1.dotEnvConfig.NODE_ENV === 'production' ? 100 : 1000,
    standardHeaders: 'draft-7', // draft-7: combined `RateLimit` header
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    keyGenerator: baseIpKey,
    skip: skipPreflight,
    handler: createRateLimitHandler('Too many requests from this IP address. Please try again later.'),
});
/**
 * 2. Auth / Brute-Force Rate Limiter:
 * Applied strictly to /auth/login, /auth/register to defend against credential stuffing and rainbow table attacks.
 * Production: 5 attempts per 15 minutes. Dev/test: relaxed so local testing never locks you out.
 */
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    limit: envConfig_1.dotEnvConfig.NODE_ENV === 'production' ? 5 : 100, // 5 requests max in prod
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count all attempts to prevent password guessing
    skip: skipPreflight,
    keyGenerator: (req) => {
        // Composite key: bind to IPv6-safe IP + email if supplied in body.
        // NOTE: req.body may be undefined on preflight/CORS OPTIONS — guard it,
        // and ALWAYS pass the IP through ipKeyGenerator (ERR_ERL_KEY_GEN_IPV6).
        const email = req.body && typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
        const ip = baseIpKey(req);
        return email ? `${ip}_${email}` : ip;
    },
    handler: createRateLimitHandler(message_interface_1.MESSAGES.ACCOUNT_LOCKED),
});
/**
 * 3. Password Reset & Sensitive OTP Limiter:
 * Extremely strict rate limiter for forgot-password, OTP verification, and email triggers.
 * Default: 3 attempts per 1 hour.
 */
exports.sensitiveActionLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: envConfig_1.dotEnvConfig.NODE_ENV === 'production' ? 3 : 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: skipPreflight,
    keyGenerator: baseIpKey,
    handler: createRateLimitHandler('Too many sensitive action attempts. Please try again in an hour.'),
});
/**
 * 4. High-Throughput Read Limiter:
 * For public search, listing views, and autocomplete endpoints.
 * Default: 300 requests per 5 minutes.
 */
exports.apiReadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: skipPreflight,
    keyGenerator: baseIpKey,
    handler: createRateLimitHandler(message_interface_1.MESSAGES.REGISTRATION_LIMIT_EXCEEDED),
});
exports.bookingCreationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: skipPreflight,
    keyGenerator: (req) => {
        const userId = req.user?.userId;
        return userId ? `booking:${userId}` : `booking:${baseIpKey(req)}`;
    },
    handler: createRateLimitHandler('Too many booking attempts. Please try again later.'),
});
exports.default = {
    globalRateLimiter: exports.globalRateLimiter,
    authRateLimiter: exports.authRateLimiter,
    sensitiveActionLimiter: exports.sensitiveActionLimiter,
    apiReadLimiter: exports.apiReadLimiter,
    bookingCreationLimiter: exports.bookingCreationLimiter,
    getClientIp: exports.getClientIp,
};
