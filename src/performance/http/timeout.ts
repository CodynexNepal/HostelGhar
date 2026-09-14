import { Request, Response, NextFunction } from 'express';

export const requestTimeout =
  (timeoutMs = 30000) =>
  (_req: Request, res: Response, next: NextFunction): void => {
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent && !res.writableEnded) {
        res.status(503).json({ success: false, message: 'Request timeout' });
      }
    });
    next();
  };
