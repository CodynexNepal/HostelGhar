"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.routes.ts
// PURPOSE: REST API Routes for Hostel Payment QR Codes (eSewa, Khalti, Bank Transfer).
//          GET, POST, PUT, PATCH, DELETE endpoints for residents and hostel owners.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentQrRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const payment_qr_factory_1 = require("../../factory/payment-qr/payment-qr.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const create_payment_qr_dto_1 = require("../../dto/payment-qr/create-payment-qr.dto");
const update_payment_qr_dto_1 = require("../../dto/payment-qr/update-payment-qr.dto");
const patch_payment_qr_dto_1 = require("../../dto/payment-qr/patch-payment-qr.dto");
const load_demo_qr_dto_1 = require("../../dto/payment-qr/load-demo-qr.dto");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const http_decorator_1 = require("../../decorators/http.decorator");
const paymentQrRouter = (0, express_1.Router)();
exports.paymentQrRouter = paymentQrRouter;
const paymentQrController = payment_qr_factory_1.PaymentQrFactory.create();
// All routes require authentication
paymentQrRouter.use(auth_middleware_1.authenticate);
// ─── GET Endpoints (Residents, Owners, Admins) ───────────────────────────────
// 1. List payment QRs (Resident gets active QRs for My Payments; Owner/Admin gets hostel list)
paymentQrRouter.get('/', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.RESIDENT, roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), paymentQrController.listPaymentQrs);
// 2. Dedicated resident view under My Payments
paymentQrRouter.get('/resident', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.RESIDENT, roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), paymentQrController.getResidentPaymentQrs);
// 3. "Preview Resident View": See how residents see the QRs
paymentQrRouter.get('/preview', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN, roles_enum_1.IROLES.RESIDENT), paymentQrController.previewResidentView);
// 4. Get single QR code by ID
paymentQrRouter.get('/:id', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN, roles_enum_1.IROLES.RESIDENT), (0, http_decorator_1.requireParam)('id'), paymentQrController.getPaymentQrById);
// ─── Owner & Admin Management Endpoints (POST, PUT, PATCH, DELETE) ───────────
// 5. "Load Demo QRs": Seeds standard eSewa, Khalti, and Bank Transfer QRs
paymentQrRouter.post('/demo', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, validate_dto_middleware_1.validateDto)(load_demo_qr_dto_1.LoadDemoQrDto), paymentQrController.loadDemoQRs);
// 6. Create / Add new payment QR code (supports file upload or JSON with qrCodeUrl)
paymentQrRouter.post('/', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), upload_middleware_1.uploadPaymentQr, (0, upload_middleware_1.stripFileFields)('qrCode', 'image', 'file', 'qr'), (0, validate_dto_middleware_1.validateDto)(create_payment_qr_dto_1.CreatePaymentQrDto), paymentQrController.createPaymentQr);
// 7. "Replace QR" / Full update (PUT)
paymentQrRouter.put('/:id', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('id'), upload_middleware_1.uploadPaymentQr, (0, upload_middleware_1.stripFileFields)('qrCode', 'image', 'file', 'qr'), (0, validate_dto_middleware_1.validateDto)(update_payment_qr_dto_1.UpdatePaymentQrDto), paymentQrController.replacePaymentQr);
// 8. Partial update (PATCH)
paymentQrRouter.patch('/:id', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('id'), upload_middleware_1.uploadPaymentQr, (0, upload_middleware_1.stripFileFields)('qrCode', 'image', 'file', 'qr'), (0, validate_dto_middleware_1.validateDto)(patch_payment_qr_dto_1.PatchPaymentQrDto), paymentQrController.patchPaymentQr);
// 9. Toggle Active / Inactive status
paymentQrRouter.patch('/:id/toggle', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('id'), paymentQrController.toggleStatus);
// 10. "Remove" / Delete QR code (DELETE)
paymentQrRouter.delete('/:id', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('id'), paymentQrController.deletePaymentQr);
