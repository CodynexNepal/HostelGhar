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

// Import Express Router — a mini-app that groups related routes together.
// Using Router instead of defining routes directly on `app` keeps the
// main app.ts clean and enables mounting routes under a prefix.
import { Router } from 'express';

// Import the DTO validation middleware factory function.
import { validateDto } from '../../middleware/validate-dto.middleware';

// Import the DTOs for registration and login input validation.
import { RegisterUserDto } from '../../dto/register.dto';
import { LoginUserDto } from '../../dto/login.dto';

// Import the controller classes that handle the HTTP request/response cycle.
import { AuthFactory } from '../../factory/auth/auth.factory';

// ─── Create Router Instance ─────────────────────────────────────────────────

// `Router()` creates an isolated group of routes. This router will be
// mounted at `/api/auth` in app.ts, so the full URLs become:
//   POST /api/auth/register
//   POST /api/auth/login
const authRouter: Router = Router();

// ─── Instantiate Controllers ────────────────────────────────────────────────

// Create controller instances. Each controller wires up its own service
// and repository in its constructor (manual dependency injection).
const authController = AuthFactory.AuthController();

// ─── Define Routes ──────────────────────────────────────────────────────────

// POST /register
// Pipeline: validateDto(RegisterUserDto) → registerController.register
//
// The middleware pipeline runs left-to-right:
// 1. `validateDto(RegisterUserDto)` — validates req.body against the DTO.
//    If validation fails, it returns 422 and STOPS — the controller never runs.
// 2. `registerController.register` — runs ONLY if validation passes.
//    It delegates to RegisterService, sets cookies, and returns JSON.
authRouter.post('/register', validateDto(RegisterUserDto), authController.register);

// POST /login
// Pipeline: validateDto(LoginUserDto) → loginController.login
//
// Same pattern: validate first, then authenticate.
// The LoginUserDto only requires email + password (no name fields).
authRouter.post('/login', validateDto(LoginUserDto), authController.login);

// ─── Export ─────────────────────────────────────────────────────────────────

// Export the router so it can be mounted in app.ts.
// Named export (not default) for explicit imports and better IDE support.
export { authRouter };
