import { Request, Response, NextFunction } from 'express';
import { applyCorsHeaders } from '../../configs/cors.config';

export const requestTimeout =
  (timeoutMs = 30000) =>
  (req: Request, res: Response, next: NextFunction): void => {
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent && !res.writableEnded) {
        applyCorsHeaders(req, res);
        res.status(503).json({ success: false, message: 'Request timeout' });
      }
    });
    next();
  };
