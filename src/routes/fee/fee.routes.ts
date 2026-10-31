import { Router } from 'express';
import { FeeFactory } from '../../factory/fee/fee.factory';
import { InvoiceController } from '../../controller/fee/invoice.controller';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { requireParam } from '../../decorators/http.decorator';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { UpdateFeeStatusDto } from '../../dto/fee/update-fee-status.dto';
import { CreateInvoiceDto } from '../../dto/fee/create-invoice.dto';
import { RecordPaymentDto } from '../../dto/payment/record-payment.dto';
import { normalizeInvoiceFields } from '../../middleware/upload.middleware';
import { paymentController } from '../../controller/payment/payment.controller';

const feeRouter = Router();
const feeController = FeeFactory.create();
const invoiceController = new InvoiceController();

// NOTE: auth guards are applied PER ROUTE (never `feeRouter.use(...)`) on purpose.
// A router-level `requireRoles(ADMIN, OWNER)` also runs for UNMATCHED `/fees/*`
// paths — e.g. resident `POST /fees/:feeId/payment-proofs`, which is handled by
// paymentProofRouter — and would wrongly 403 residents before Express falls through.
const ownerOrAdmin = [authenticate, requireRoles(IROLES.ADMIN, IROLES.OWNER)];

feeRouter.get('/nepali-status', ...ownerOrAdmin, feeController.nepaliBillingStatus);
feeRouter.post(
  '/invoices',
  ...ownerOrAdmin,
  normalizeInvoiceFields,
  validateDto(CreateInvoiceDto),
  invoiceController.createInvoice,
);
feeRouter.post('/generate-monthly', ...ownerOrAdmin, feeController.generateMonthlyFees);
feeRouter.get('/jobs/:jobId', ...ownerOrAdmin, requireParam('jobId'), feeController.getJobStatus);
feeRouter.get(
  '/hostels/:hostelId',
  ...ownerOrAdmin,
  requireParam('hostelId'),
  feeController.listHostelFees,
);
feeRouter.get(
  '/hostels/:hostelId/payments',
  ...ownerOrAdmin,
  requireParam('hostelId'),
  paymentController.getHostelPayments,
);
feeRouter.post('/sync-overdue', ...ownerOrAdmin, paymentController.syncOverdue);
feeRouter.get('/:id', authenticate, requireParam('id'), paymentController.getInvoice);
feeRouter.post(
  '/:id/payments',
  ...ownerOrAdmin,
  requireParam('id'),
  validateDto(RecordPaymentDto),
  paymentController.recordPayment,
);
feeRouter.patch('/:id/payment', ...ownerOrAdmin, requireParam('id'), feeController.recordPayment);
feeRouter.patch(
  '/:id/status',
  ...ownerOrAdmin,
  requireParam('id'),
  validateDto(UpdateFeeStatusDto),
  feeController.updateStatus,
);

export { feeRouter };
