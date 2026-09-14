import compression from 'compression';
import { Express } from 'express';

export const registerPerformanceMiddleware = (app: Express): void => {
  app.use(compression());
};
