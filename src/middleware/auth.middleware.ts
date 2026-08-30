// ──────────────────────────────────────────────────────────────────────────────
// FILE: auth.middleware.ts
// PURPOSE: JWT verification & RBAC authorization middleware.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { JwtTokenService, ITokenPayload } from '../utils/jwt-token.util';
import { STATUS_CODE } from '../constant/statusCode.interface';
import { IROLES } from '../enum/roles.enum';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: ITokenPayload;
    }
  }
}

/**
 * Authenticates JWT token from Authorization header or cookies
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
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

  req.user = payload as unknown as ITokenPayload;
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
        message: `Forbidden. This action requires one of the following roles: [${allowedRoles.join(', ')}]`,
      });
      return;
    }

    next();
  };
};
