import { Express } from 'express';
import { compressionMiddleware } from './http/compression';

export const registerPerformanceMiddleware = (app: Express): void => {
  // Brotli-first response compression (see http/compression.ts). Registered
  // before the routes so its res.write/res.end overrides wrap every handler's
  // response — JSON payloads go out ~15-25% smaller than gzip would send them.
  app.use(compressionMiddleware);
};
