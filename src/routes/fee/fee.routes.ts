import { Router } from 'express';
import { FeeFactory } from '../../factory/fee/fee.factory';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { sensitiveActionLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';

const feeRouter = Router();
const feeController = FeeFactory.create();

feeRouter.use(authenticate, requireRoles(IROLES.ADMIN, IROLES.OWNER));
feeRouter.post('/generate-monthly', sensitiveActionLimiter, feeController.generateMonthlyFees);
feeRouter.get('/hostels/:hostelId', requireParam('hostelId'), feeController.listHostelFees);
feeRouter.patch(
  '/:id/payment',
  requireParam('id'),
  sensitiveActionLimiter,
  feeController.recordPayment,
);

export { feeRouter };
