import { Router } from 'express';
import { FeeFactory } from '../../factory/fee/fee.factory';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { sensitiveActionLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';

const feeRouter = Router();
const feeController = FeeFactory.create();

// NOTE: auth guards are applied PER ROUTE (never `feeRouter.use(...)`) on purpose.
// A router-level `requireRoles(ADMIN, OWNER)` also runs for UNMATCHED `/fees/*`
// paths — e.g. resident `POST /fees/:feeId/payment-proofs`, which is handled by
// paymentProofRouter — and would wrongly 403 residents before Express falls through.
const ownerOrAdmin = [authenticate, requireRoles(IROLES.ADMIN, IROLES.OWNER)];

feeRouter.get('/nepali-status', ...ownerOrAdmin, feeController.nepaliBillingStatus);
feeRouter.post(
  '/generate-monthly',
  ...ownerOrAdmin,
  sensitiveActionLimiter,
  feeController.generateMonthlyFees,
);
feeRouter.get(
  '/hostels/:hostelId',
  ...ownerOrAdmin,
  requireParam('hostelId'),
  feeController.listHostelFees,
);
feeRouter.patch(
  '/:id/payment',
  ...ownerOrAdmin,
  requireParam('id'),
  sensitiveActionLimiter,
  feeController.recordPayment,
);

export { feeRouter };
