// ──────────────────────────────────────────────────────────────────────────────
// FILE: app.ts
// PURPOSE: Creates and configures the Express application instance with all
//          necessary middleware and routes. This is the "composition root" —
//          the single place where all middleware are registered in the correct
//          order and all routes are mounted.
//
// MIDDLEWARE ORDER MATTERS:
//   1. Security middleware (helmet) — must run first to set security headers
//      on EVERY response, even error responses.
//   2. CORS — must run before route handlers to handle preflight requests.
//   3. Body parsers (json, cookie-parser) — must run before routes so that
//      `req.body` and `req.cookies` are populated when controllers read them.
//   4. Routes — the actual API endpoints.
//
// OOP PRINCIPLE: This function follows the Factory Pattern — it creates and
//                returns a fully-configured Express app. The caller (index.ts)
//                doesn't need to know how the app is assembled.
// ──────────────────────────────────────────────────────────────────────────────

// Import Express and its type for the application instance.
import express, { Express } from 'express';

// `helmet` sets various HTTP security headers automatically:
//   - X-Content-Type-Options: nosniff (prevents MIME-type sniffing)
//   - X-Frame-Options: DENY (prevents clickjacking)
//   - Strict-Transport-Security (forces HTTPS)
//   - Content-Security-Policy (prevents XSS)
// One line of code, ~12 security headers. No reason not to use it.
import helmet from 'helmet';

// `cors` handles Cross-Origin Resource Sharing. Without it, browsers
// block requests from frontend apps hosted on a different domain/port.
// `credentials: true` is critical — it tells the browser to include
// cookies in cross-origin requests, which is required for our
// HttpOnly cookie-based auth to work with a separate frontend.
import cors from 'cors';

// `cookie-parser` parses the Cookie header on incoming requests and
// populates `req.cookies` with an object. Without this middleware,
// `req.cookies` would be `undefined` and we couldn't read auth tokens.
import cookieParser from 'cookie-parser';

import routes from '../routes/index.routes';
import { errorHandler } from '../middleware/error-handler.middleware';

// ─── createApp() Factory Function ───────────────────────────────────────────

export const createApp = (): Express => {
  // Create a new Express application instance.
  const app: Express = express();

  // ─── Security Middleware ──────────────────────────────────────────────

  // Register helmet FIRST so all responses (including errors) get
  // security headers. If we registered it after routes, error responses
  // from routes that throw before reaching helmet would be unprotected.
  app.use(helmet());

  // ─── CORS Configuration ──────────────────────────────────────────────

  // Configure CORS to allow the frontend to make requests to this API.
  app.use(
    cors({
      // `origin: true` reflects the request's Origin header back in the
      // Access-Control-Allow-Origin response header. In production, replace
      // this with your specific frontend URL (e.g., 'https://hostelghar.com')
      // to prevent unauthorized domains from making API calls.
      origin: true,

      // `credentials: true` is MANDATORY for cookie-based auth.
      // It adds `Access-Control-Allow-Credentials: true` to responses,
      // which tells the browser "yes, you may include cookies in
      // cross-origin requests to this API".
      // Without this, the browser silently strips cookies from requests,
      // and authentication breaks.
      credentials: true,

      // Explicitly allow these HTTP methods. OPTIONS is needed for
      // CORS preflight requests that browsers send automatically.
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],

      // Allow the Content-Type header (needed for JSON requests) and
      // Authorization (for any non-cookie auth fallback).
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ─── Body Parsers ────────────────────────────────────────────────────

  // Parse JSON request bodies. Without this, `req.body` is `undefined`
  // for POST/PUT requests with Content-Type: application/json.
  // `limit: '10mb'` prevents denial-of-service via extremely large
  // request bodies that could exhaust server memory.
  app.use(express.json({ limit: '10mb' }));

  // Parse URL-encoded form bodies (e.g., from HTML forms).
  // `extended: true` uses the `qs` library for rich object/array parsing.
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Parse Cookie headers and populate `req.cookies`.
  // This is REQUIRED for our auth system — without it, we cannot read
  // the access_token and refresh_token cookies from incoming requests.
  app.use(cookieParser());

  // ─── API Routes ──────────────────────────────────────────────────────

  // Mount the auth routes at `/api/auth`. This means:
  //   POST /api/auth/register
  //   POST /api/auth/login
  // The `/api` prefix is a convention that separates API endpoints from
  // static file serving or frontend routes.
  app.use('/api/v1/hostel-ghar', routes);

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

  // ─── Global Error Handler ────────────────────────────────────────────
  app.use(errorHandler);

  // Return the fully-configured app to the caller (index.ts).
  return app;
};
