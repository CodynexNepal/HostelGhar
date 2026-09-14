import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export const httpLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.header('x-request-id') || randomUUID();
  const start = process.hrtime.bigint();
  res.setHeader('x-request-id', requestId);

  res.once('finish', () => {
    logger.info('HTTP request completed', {
      request_id: requestId,
      http_method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
      duration_ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
    });
  });

  next();
};
