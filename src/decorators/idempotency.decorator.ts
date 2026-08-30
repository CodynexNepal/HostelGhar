import { NextFunction, Request, RequestHandler, Response } from 'express';
import { STATUS_CODE } from '../constant/statusCode.interface';

type CachedResponse = {
  statusCode: number;
  body: unknown;
  expiresAt: number;
};

const store = new Map<string, CachedResponse>();
const DEFAULT_TTL_MS = 10 * 60 * 1000;

const cleanupExpiredKeys = (): void => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) {
      store.delete(key);
    }
  }
};

export const idempotencyKey = (ttlMs = DEFAULT_TTL_MS): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    cleanupExpiredKeys();

    const rawKey = req.headers['idempotency-key'];
    const requestKey = typeof rawKey === 'string' ? rawKey.trim() : '';

    if (!requestKey) {
      res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Idempotency-Key header is required for this operation',
      });
      return;
    }

    const scopedKey = `${req.method}:${req.originalUrl}:${req.user?.userId || 'anonymous'}:${requestKey}`;
    const cached = store.get(scopedKey);

    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('Idempotency-Replayed', 'true');
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(scopedKey, {
          statusCode: res.statusCode,
          body,
          expiresAt: Date.now() + ttlMs,
        });
      }

      return originalJson(body);
    };

    next();
  };
};
