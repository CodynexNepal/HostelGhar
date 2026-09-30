// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.routes.ts
// PURPOSE: REST API Routes for Hostel Payment QR Codes (eSewa, Khalti, Bank Transfer).
//          GET, POST, PUT, PATCH, DELETE endpoints for residents and hostel owners.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { PaymentQrFactory } from '../../factory/payment-qr/payment-qr.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreatePaymentQrDto } from '../../dto/payment-qr/create-payment-qr.dto';
import { UpdatePaymentQrDto } from '../../dto/payment-qr/update-payment-qr.dto';
import { PatchPaymentQrDto } from '../../dto/payment-qr/patch-payment-qr.dto';
import { LoadDemoQrDto } from '../../dto/payment-qr/load-demo-qr.dto';
import { uploadPaymentQr, stripFileFields } from '../../middleware/upload.middleware';
import { requireParam } from '../../decorators/http.decorator';

const paymentQrRouter = Router();
const paymentQrController = PaymentQrFactory.create();

// All routes require authentication
paymentQrRouter.use(authenticate);

// ─── GET Endpoints (Residents, Owners, Admins) ───────────────────────────────
// 1. List payment QRs (Resident gets active QRs for My Payments; Owner/Admin gets hostel list)
paymentQrRouter.get(
  '/',
  requireRoles(IROLES.RESIDENT, IROLES.OWNER, IROLES.ADMIN),
  paymentQrController.listPaymentQrs,
);

// 2. Dedicated resident view under My Payments
paymentQrRouter.get(
  '/resident',
  requireRoles(IROLES.RESIDENT, IROLES.OWNER, IROLES.ADMIN),
  paymentQrController.getResidentPaymentQrs,
);

// 3. "Preview Resident View": See how residents see the QRs
paymentQrRouter.get(
  '/preview',
  requireRoles(IROLES.OWNER, IROLES.ADMIN, IROLES.RESIDENT),
  paymentQrController.previewResidentView,
);

// 4. Get single QR code by ID
paymentQrRouter.get(
  '/:id',
  requireRoles(IROLES.OWNER, IROLES.ADMIN, IROLES.RESIDENT),
  requireParam('id'),
  paymentQrController.getPaymentQrById,
);

// ─── Owner & Admin Management Endpoints (POST, PUT, PATCH, DELETE) ───────────

// 5. "Load Demo QRs": Seeds standard eSewa, Khalti, and Bank Transfer QRs
paymentQrRouter.post(
  '/demo',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  validateDto(LoadDemoQrDto),
  paymentQrController.loadDemoQRs,
);

// 6. Create / Add new payment QR code (supports file upload or JSON with qrCodeUrl)
paymentQrRouter.post(
  '/',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  uploadPaymentQr,
  stripFileFields('qrCode', 'image', 'file', 'qr'),
  validateDto(CreatePaymentQrDto),
  paymentQrController.createPaymentQr,
);

// 7. "Replace QR" / Full update (PUT)
paymentQrRouter.put(
  '/:id',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('id'),
  uploadPaymentQr,
  stripFileFields('qrCode', 'image', 'file', 'qr'),
  validateDto(UpdatePaymentQrDto),
  paymentQrController.replacePaymentQr,
);

// 8. Partial update (PATCH)
paymentQrRouter.patch(
  '/:id',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('id'),
  uploadPaymentQr,
  stripFileFields('qrCode', 'image', 'file', 'qr'),
  validateDto(PatchPaymentQrDto),
  paymentQrController.patchPaymentQr,
);

// 9. Toggle Active / Inactive status
paymentQrRouter.patch(
  '/:id/toggle',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('id'),
  paymentQrController.toggleStatus,
);

// 10. "Remove" / Delete QR code (DELETE)
paymentQrRouter.delete(
  '/:id',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('id'),
  paymentQrController.deletePaymentQr,
);

export { paymentQrRouter };
