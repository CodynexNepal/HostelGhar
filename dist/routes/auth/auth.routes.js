"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: auth.routes.ts
// PURPOSE: Defines all authentication-related HTTP routes. Routes are the
//          "wiring" layer — they connect URL patterns to middleware pipelines
//          and controller methods. No business logic lives here.
//
// ROUTE DESIGN:
//   POST /api/auth/register — create a new user account
//   POST /api/auth/login    — authenticate and receive tokens
//
//   Both routes use POST because they modify server state (creating a user,
//   generating tokens). GET would be semantically wrong and would expose
//   credentials in URL query parameters (visible in browser history, logs,
//   and proxy caches).
//
// OOP PRINCIPLE: Open/Closed — adding new auth endpoints (e.g., /logout,
//                /refresh, /forgot-password) means adding new lines here,
//                not modifying existing ones.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
// Import Express Router — a mini-app that groups related routes together.
// Using Router instead of defining routes directly on `app` keeps the
// main app.ts clean and enables mounting routes under a prefix.
const express_1 = require("express");
// Import the DTO validation middleware factory function.
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
// Import the DTOs for registration and login input validation.
const register_dto_1 = require("../../dto/auth/register.dto");
const login_dto_1 = require("../../dto/auth/login.dto");
const forgot_password_dto_1 = require("../../dto/auth/forgot-password.dto");
const reset_password_dto_1 = require("../../dto/auth/reset-password.dto");
const change_password_dto_1 = require("../../dto/auth/change-password.dto");
// Import the controller classes that handle the HTTP request/response cycle.
const auth_factory_1 = require("../../factory/auth/auth.factory");
//Import the Rate Limit
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
const auth_middleware_1 = require("../../middleware/auth.middleware");
// ─── Create Router Instance ─────────────────────────────────────────────────
// `Router()` creates an isolated group of routes. This router will be
// mounted at `/api/auth` in app.ts, so the full URLs become:
//   POST /api/auth/register
//   POST /api/auth/login
const authRouter = (0, express_1.Router)();
exports.authRouter = authRouter;
const authController = auth_factory_1.AuthFactory.create();
authRouter.post('/login', rateLimiter_config_1.authRateLimiter, (0, validate_dto_middleware_1.validateDto)(login_dto_1.LoginUserDto), authController.login);
authRouter.post('/register', rateLimiter_config_1.authRateLimiter, (0, validate_dto_middleware_1.validateDto)(register_dto_1.RegisterUserDto), authController.register);
authRouter.post('/forgot-password', rateLimiter_config_1.sensitiveActionLimiter, (0, validate_dto_middleware_1.validateDto)(forgot_password_dto_1.ForgotPasswordDto), authController.forgotPassword);
authRouter.patch('/reset-password', rateLimiter_config_1.sensitiveActionLimiter, (0, validate_dto_middleware_1.validateDto)(reset_password_dto_1.ResetPasswordDto), authController.resetPassword);
authRouter.put('/change-password', auth_middleware_1.authenticate, rateLimiter_config_1.sensitiveActionLimiter, (0, validate_dto_middleware_1.validateDto)(change_password_dto_1.ChangePasswordDto), authController.changePassword);
// ─── Session helpers (frontend boot / role redirect) ───────────────────────
// GET /api/v1/hostel-ghar/auth/me — current user incl. `role`.
// Frontend calls this after login + on page reload to decide which
// dashboard to redirect to (admin | owner | resident | user).
authRouter.get('/me', auth_middleware_1.authenticate, authController.me);
// Token rotation + logout. Logout is idempotent by design: it accepts an
// EXPIRED access token (optionalAuthenticate fills req.user when possible,
// then authenticate is skipped on failure) so a client with a stale token
// can still kill its session/caches instead of being stuck 401-logged-in.
// POST /auth/logout            -> current device (?logoutAll=true -> all)
// POST /auth/logout/all        -> explicit all-devices kill switch
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', auth_middleware_1.optionalAuthenticate, authController.logout);
authRouter.post('/logout/all', auth_middleware_1.optionalAuthenticate, authController.logoutAll);
