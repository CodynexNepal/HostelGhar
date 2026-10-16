import { Express } from 'express';
import { compressionMiddleware } from './http/compression';

export const registerPerformanceMiddleware = (app: Express): void => {
  // Brotli-first response compression (see http/compression.ts). The caller
  // (src/configs/app.ts) registers this AFTER helmet/CORS and BEFORE body
  // parsers, rate limiters and routes, so its res.write/res.end overrides wrap
  // every handler's response — JSON payloads go out ~15-25% smaller than gzip
  // would send them — without ever touching preflights or security headers.
  app.use(compressionMiddleware);
};
