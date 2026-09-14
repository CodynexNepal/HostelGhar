import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export const errorTrackingMiddleware = (
  error: unknown,
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  logger.error('Unhandled request error', {
    request_id: req.header('x-request-id'),
    error: error instanceof Error ? error.message : String(error),
  });
  next(error);
};
