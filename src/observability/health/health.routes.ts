import { Router } from 'express';
import { livenessHandler } from './liveness';
import { readinessHandler } from './readiness';

export const healthRouter = Router();
healthRouter.get('/live', livenessHandler);
healthRouter.get('/ready', readinessHandler);
