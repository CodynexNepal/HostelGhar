"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: app.ts
// PURPOSE: Creates and configures the Express application instance with all
//          necessary middleware and routes. This is the "composition root" —
//          the single place where all middleware are registered in the correct
//          order and all routes are mounted.
//
// MIDDLEWARE ORDER MATTERS:
//   1. Observability first (request-id logging, metrics) — passive listeners
//      that must observe every request, including blocked/failed ones.
//   2. Security middleware (helmet) — must run first among response writers
//      to set security headers on EVERY response, even error responses.
//   3. CORS — must run before route handlers to handle preflight requests.
//      An explicit OPTIONS short-circuit is registered FIRST so a browser
//      preflight can NEVER hang waiting on body parsers / rate limiters.
//   4. Compression — AFTER helmet/CORS (so it never compresses preflights or
//      strips security headers), BEFORE body parsers/routes (so its
//      res.write/res.end overrides wrap every API/error response).
//   5. Body parsers (json, cookie-parser) — must run before routes so that
//      `req.body` and `req.cookies` are populated when controllers read them.
//   6. Rate limiter — AFTER body parsers (auth limiter keys on req.body.email)
//      and NEVER on OPTIONS (skipPreflight inside every limiter).
//   7. Routes — the actual API endpoints.
//
// OOP PRINCIPLE: This function follows the Factory Pattern — it creates and
//                returns a fully-configured Express app. The caller (index.ts)
//                doesn't need to know how the app is assembled.
// ──────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
// Import Express and its type for the application instance.
const express_1 = __importDefault(require("express"));
// `helmet` sets various HTTP security headers automatically:
//   - X-Content-Type-Options: nosniff (prevents MIME-type sniffing)
//   - X-Frame-Options: DENY (prevents clickjacking)
//   - Strict-Transport-Security (forces HTTPS)
//   - Content-Security-Policy (prevents XSS)
// One line of code, ~12 security headers. No reason not to use it.
const helmet_1 = __importDefault(require("helmet"));
// `cors` handles Cross-Origin Resource Sharing. Without it, browsers
// block requests from frontend apps hosted on a different domain/port.
// `credentials: true` is critical — it tells the browser to include
// cookies in cross-origin requests, which is required for our
// HttpOnly cookie-based auth to work with a separate frontend.
const cors_1 = __importDefault(require("cors"));
// `cookie-parser` parses the Cookie header on incoming requests and
// populates `req.cookies` with an object. Without this middleware,
// `req.cookies` would be `undefined` and we couldn't read auth tokens.
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const index_routes_1 = __importDefault(require("../routes/index.routes"));
const error_handler_middleware_1 = require("../middleware/error-handler.middleware");
const not_found_middleware_1 = require("../middleware/not-found.middleware");
const socket_middleware_1 = require("../middleware/socket.middleware");
const rateLimiter_config_1 = require("./rateLimiter.config");
const cors_config_1 = require("./cors.config");
const http_middleware_1 = require("../observability/http.middleware");
const metrics_1 = require("../observability/metrics");
const performance_middleware_1 = require("../performance/performance.middleware");
const timeout_1 = require("../performance/http/timeout");
const health_routes_1 = require("../observability/health/health.routes");
const circuit_breaker_util_1 = require("../utils/circuit-breaker.util");
// ─── createApp() Factory Function ───────────────────────────────────────────
const createApp = () => {
    // Create a new Express application instance.
    const app = (0, express_1.default)();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(http_middleware_1.httpLoggingMiddleware);
    app.use(metrics_1.metricsMiddleware);
    app.use((0, timeout_1.requestTimeout)(Number(process.env.HTTP_TIMEOUT_MS || 30000)));
    // ─── Security Middleware ──────────────────────────────────────────────
    // Register helmet FIRST so all responses (including errors) get
    // security headers. If we registered it after routes, error responses
    // from routes that throw before reaching helmet would be unprotected.
    app.use((0, helmet_1.default)());
    // ─── CORS Configuration ──────────────────────────────────────────────
    // Configure CORS to allow the frontend to make requests to this API.
    // NOTE: `cors()` with `preflightContinue: false` already answers EVERY
    // OPTIONS preflight with 204 right here, before any downstream middleware
    // (body parsers / rate limiters / routes) runs — so preflights can never
    // hang. Do NOT add `app.options('*', ...)` — the bare `'*'` pattern throws
    // a PathError on Express 5 (path-to-regexp v8) and would crash startup.
    app.use((0, cors_1.default)(cors_config_1.corsConfig));
    // ─── Response Compression ────────────────────────────────────────────
    // AFTER helmet/CORS (never compresses preflights, never strips security
    // headers), BEFORE body parsers/routes/rate-limiters/error handlers so the
    // res.write/res.end overrides wrap every API, health, metrics and error
    // response. See src/performance/http/compression.ts for the full policy
    // (Brotli-first, 1 KiB threshold, Set-Cookie/SSE/206 exclusions).
    // Hosting note: Render / Docker compose in this repo has NO reverse proxy
    // that compresses (no nginx/CDN layer) — this middleware is the single
    // compression point, so there is no double-compression risk. If a CDN or
    // proxy with compression is added later, disable one of the two layers.
    (0, performance_middleware_1.registerPerformanceMiddleware)(app);
    // ─── Body Parsers ────────────────────────────────────────────────────
    // Parse JSON request bodies. Without this, `req.body` is `undefined`
    // for POST/PUT requests with Content-Type: application/json.
    // `limit: '10mb'` prevents denial-of-service via extremely large
    // request bodies that could exhaust server memory.
    app.use(express_1.default.json({ limit: '10mb' }));
    // Parse URL-encoded form bodies (e.g., from HTML forms).
    // `extended: true` uses the `qs` library for rich object/array parsing.
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Parse Cookie headers and populate `req.cookies`.
    // This is REQUIRED for our auth system — without it, we cannot read
    // the access_token and refresh_token cookies from incoming requests.
    app.use((0, cookie_parser_1.default)());
    // ─── Socket.io Context Middleware ────────────────────────────────────
    // Injects `req.io`, `req.notifyUser`, `req.notifyHostel`, `req.broadcastEvent`
    // so every single endpoint/controller can emit real-time updates directly.
    // NOTE: socketContextMiddleware is a safe no-op when sockets aren't ready —
    // it must NEVER throw or block, or every request (incl. preflight) hangs.
    app.use(socket_middleware_1.socketContextMiddleware);
    // Global rate limiter runs AFTER body parsers (auth limiter keys on
    // req.body.email) and skips OPTIONS via skipPreflight, so preflights
    // never burn budget or wait on limiter state.
    app.use(rateLimiter_config_1.globalRateLimiter);
    // ─── API Routes ──────────────────────────────────────────────────────
    // Mount the auth routes at `/api/auth`. This means:
    //   POST /api/auth/register
    //   POST /api/auth/login
    // The `/api` prefix is a convention that separates API endpoints from
    // static file serving or frontend routes.
    app.use('/api/v1/hostel-ghar', index_routes_1.default);
    // ─── Health Check ────────────────────────────────────────────────────
    // A simple health check endpoint that load balancers, Docker, and
    // Kubernetes use to verify the server is running and responsive.
    // Returns 200 OK with minimal data — no database check (that would
    // make the health check dependent on DB availability).
    app.get('/health', (_req, res) => {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
        });
    });
    app.use('/health', health_routes_1.healthRouter);
    app.get('/health/circuit-breakers', (_req, res) => {
        res.status(200).json({ status: 'ok', breakers: (0, circuit_breaker_util_1.getCircuitBreakerHealth)() });
    });
    app.get('/metrics', metrics_1.metricsHandler);
    // ─── Global Error Handler ────────────────────────────────────────────
    // 404 JSON fallthrough MUST come before the error handler: without it an
    // unmatched path (e.g. wrong /api prefix from the dashboard) falls through
    // Express with no response handler — the browser shows (pending) forever.
    app.use(not_found_middleware_1.notFoundHandler);
    app.use(error_handler_middleware_1.errorHandler);
    // Return the fully-configured app to the caller (index.ts).
    return app;
};
exports.createApp = createApp;
