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
import { RegisterUserDto } from '../../dto/auth/register.dto';
import { LoginUserDto } from '../../dto/auth/login.dto';
import { ForgotPasswordDto } from '../../dto/auth/forgot-password.dto';
import { ResetPasswordDto } from '../../dto/auth/reset-password.dto';
import { ChangePasswordDto } from '../../dto/auth/change-password.dto';

// Import the controller classes that handle the HTTP request/response cycle.
import { AuthFactory } from '../../factory/auth/auth.factory';

//Import the Rate Limit

import { authRateLimiter, sensitiveActionLimiter } from '../../configs/rateLimiter.config';
import { authenticate } from '../../middleware/auth.middleware';

// ─── Create Router Instance ─────────────────────────────────────────────────

// `Router()` creates an isolated group of routes. This router will be
// mounted at `/api/auth` in app.ts, so the full URLs become:
//   POST /api/auth/register
//   POST /api/auth/login
const authRouter: Router = Router();

const authController = AuthFactory.create();

authRouter.post('/login', validateDto(LoginUserDto), authRateLimiter, authController.login);

authRouter.post(
  '/register',
  validateDto(RegisterUserDto),
  authRateLimiter,
  authController.register,
);

authRouter.post(
  '/forgot-password',
  sensitiveActionLimiter,
  validateDto(ForgotPasswordDto),
  authController.forgotPassword,
);

authRouter.patch(
  '/reset-password',
  sensitiveActionLimiter,
  validateDto(ResetPasswordDto),
  authController.resetPassword,
);

authRouter.put(
  '/change-password',
  authenticate,
  sensitiveActionLimiter,
  validateDto(ChangePasswordDto),
  authController.changePassword,
);

// ─── Export ─────────────────────────────────────────────────────────────────

// Export the router so it can be mounted in app.ts.
// Named export (not default) for explicit imports and better IDE support.
export { authRouter };
