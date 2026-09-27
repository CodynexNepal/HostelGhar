// ─────────────────────────────────────────────────────────────
// FILE: payment-proof.routes.ts
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreatePaymentProofDto } from '../../dto/payment-proof/create-payment-proof.dto';
import { ReviewPaymentProofDto } from '../../dto/payment-proof/review-payment-proof.dto';
import { PaymentProofFactory } from '../../factory/payment-proof/payment-proof.factory';
import { stripFileFields, uploadPaymentProof } from '../../middleware/upload.middleware';
import { requireParam } from '../../decorators/http.decorator';

const paymentProofRouter = Router();
const paymentProofController = PaymentProofFactory.create();

paymentProofRouter.use(authenticate);

paymentProofRouter.post(
  '/fees/:feeId/payment-proofs',
  requireRoles(IROLES.RESIDENT, IROLES.ADMIN),
  requireParam('feeId'),
  uploadPaymentProof,
  stripFileFields('screenshot', 'receipt', 'image', 'file', 'hostelId'),
  validateDto(CreatePaymentProofDto),
  paymentProofController.submitProof,
);

paymentProofRouter.get(
  '/payment-proofs/mine',
  requireRoles(IROLES.RESIDENT, IROLES.ADMIN),
  paymentProofController.listMyProofs,
);

paymentProofRouter.get(
  '/payment-proofs/hostels/:hostelId',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('hostelId'),
  paymentProofController.listHostelProofs,
);

// Alias: clients that group proof queries under `/fees` call
// GET /fees/hostels/:hostelId/payment-proofs. This router is mounted at `/`
// BEFORE feeRouter (`/fees`), so the longer path resolves here and never
// reaches feeRouter's GET /hostels/:hostelId.
paymentProofRouter.get(
  '/fees/hostels/:hostelId/payment-proofs',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('hostelId'),
  paymentProofController.listHostelProofs,
);

paymentProofRouter.get(
  '/fees/:feeId/payment-proofs',
  requireRoles(IROLES.RESIDENT, IROLES.OWNER, IROLES.ADMIN),
  requireParam('feeId'),
  paymentProofController.listFeeProofs,
);

paymentProofRouter.patch(
  '/payment-proofs/:id/review',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('id'),
  validateDto(ReviewPaymentProofDto),
  paymentProofController.reviewProof,
);

export { paymentProofRouter };
