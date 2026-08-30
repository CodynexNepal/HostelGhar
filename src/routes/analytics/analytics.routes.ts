import { Router } from 'express';
import { AnalyticsFactory } from '../../factory/analytics/analytics.factory';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';

const analyticsRouter = Router();
const analyticsController = AnalyticsFactory.create();

analyticsRouter.use(authenticate, apiReadLimiter);
analyticsRouter.get('/admin/summary', requireRoles(IROLES.ADMIN), analyticsController.adminSummary);
analyticsRouter.get(
  '/owner/summary',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  analyticsController.ownerSummary,
);

export { analyticsRouter };
