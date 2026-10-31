// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.routes.ts
// PURPOSE: Dedicated endpoints for payment receipts and audit history.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireParam } from '../../decorators/http.decorator';
import { paymentController } from '../../controller/payment/payment.controller';

const paymentRouter = Router();

paymentRouter.use(authenticate);

paymentRouter.get('/:id/receipt', requireParam('id'), paymentController.getReceipt);

export { paymentRouter };
