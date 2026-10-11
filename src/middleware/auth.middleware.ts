// ──────────────────────────────────────────────────────────────────────────────
// FILE: auth.middleware.ts
// PURPOSE: JWT verification & RBAC authorization middleware.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { JwtTokenService, ITokenPayload } from '../utils/jwt-token.util';
import { STATUS_CODE } from '../constant/statusCode.interface';
import { IROLES } from '../enum/roles.enum';
import {
  isTokenBlocklisted,
  isRevokedByLogoutAll,
  getTokenIssuedAtMs,
} from '../utils/token-blocklist.util';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: ITokenPayload;
      hostelId?: string;
    }
  }
}

/**
 * Authenticates JWT token from Authorization header or cookies
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    res.status(STATUS_CODE.UNAUTHORIZED).json({
      success: false,
      message: 'Authentication required. Please provide a valid token.',
    });
    return;
  }

  const payload = JwtTokenService.verifyAccessToken(token);
  if (!payload) {
    res.status(STATUS_CODE.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
    return;
  }

  const user = payload as unknown as ITokenPayload;
  try {
    if (await isTokenBlocklisted(token)) {
      res.status(STATUS_CODE.UNAUTHORIZED).json({
        success: false,
        message: 'Session revoked. Please sign in again.',
      });
      return;
    }
    if (user?.userId && (await isRevokedByLogoutAll(user.userId, getTokenIssuedAtMs(token)))) {
      res.status(STATUS_CODE.UNAUTHORIZED).json({
        success: false,
        message: 'Session revoked. Please sign in again.',
      });
      return;
    }
  } catch {
    // Fail open is handled inside the blocklist helpers; continue.
  }

  req.user = user;
  next();
};

export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.cookies?.access_token;
  if (token) {
    const payload = JwtTokenService.verifyAccessToken(token);
    if (payload) req.user = payload as unknown as ITokenPayload;
  }
  next();
};

/**
 * Restricts access to specific roles (RBAC)
 */
export const requireRoles = (...allowedRoles: (IROLES | string)[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(STATUS_CODE.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const userRole = req.user.role?.toLowerCase();
    const hasRole = allowedRoles.some((r) => r.toLowerCase() === userRole);

    if (!hasRole) {
      res.status(STATUS_CODE.FORBIDDEN).json({
        success: false,
        message: `Forbidden. This action requires one of the following roles: [${allowedRoles.join(', ')}] (your role: ${req.user.role ?? 'unknown'})`,
      });
      return;
    }

    next();
  };
};
