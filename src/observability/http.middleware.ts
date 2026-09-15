import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export const httpLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.header('x-request-id') || randomUUID();
  const start = process.hrtime.bigint();
  res.setHeader('x-request-id', requestId);

  res.once('finish', () => {
    // CORS preflight (OPTIONS → 204) is answered by the `cors` middleware
    // before any controller runs. It is NOT an error / NOT a failed request.
    // Logging every preflight at `info` level buries the real GET/POST logs
    // and makes it look like "only 204s". Keep it at debug.
    if (req.method === 'OPTIONS') {
      logger.debug('CORS preflight handled', {
        request_id: requestId,
        http_method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode,
        duration_ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
      });
      return;
    }
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
