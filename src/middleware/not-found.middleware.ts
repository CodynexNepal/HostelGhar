import { Request, Response } from 'express';
import { STATUS_CODE } from '../constant/statusCode.interface';

/**
 * 404 JSON fallthrough. Express 5 does NOT auto-respond on unmatched paths —
 * without this, a wrong URL prefix hangs as (pending) in DevTools forever.
 * Must be registered AFTER all routes but BEFORE the error handler.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(STATUS_CODE.NOT_FOUND).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};
