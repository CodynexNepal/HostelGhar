"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feeRouter = void 0;
const express_1 = require("express");
const fee_factory_1 = require("../../factory/fee/fee.factory");
const invoice_controller_1 = require("../../controller/fee/invoice.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const http_decorator_1 = require("../../decorators/http.decorator");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const update_fee_status_dto_1 = require("../../dto/fee/update-fee-status.dto");
const create_invoice_dto_1 = require("../../dto/fee/create-invoice.dto");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const feeRouter = (0, express_1.Router)();
exports.feeRouter = feeRouter;
const feeController = fee_factory_1.FeeFactory.create();
const invoiceController = new invoice_controller_1.InvoiceController();
// NOTE: auth guards are applied PER ROUTE (never `feeRouter.use(...)`) on purpose.
// A router-level `requireRoles(ADMIN, OWNER)` also runs for UNMATCHED `/fees/*`
// paths — e.g. resident `POST /fees/:feeId/payment-proofs`, which is handled by
// paymentProofRouter — and would wrongly 403 residents before Express falls through.
const ownerOrAdmin = [auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN, roles_enum_1.IROLES.OWNER)];
feeRouter.get('/nepali-status', ...ownerOrAdmin, feeController.nepaliBillingStatus);
feeRouter.post('/invoices', ...ownerOrAdmin, upload_middleware_1.normalizeInvoiceFields, (0, validate_dto_middleware_1.validateDto)(create_invoice_dto_1.CreateInvoiceDto), invoiceController.createInvoice);
feeRouter.post('/generate-monthly', ...ownerOrAdmin, feeController.generateMonthlyFees);
feeRouter.get('/jobs/:jobId', ...ownerOrAdmin, (0, http_decorator_1.requireParam)('jobId'), feeController.getJobStatus);
feeRouter.get('/hostels/:hostelId', ...ownerOrAdmin, (0, http_decorator_1.requireParam)('hostelId'), feeController.listHostelFees);
feeRouter.patch('/:id/payment', ...ownerOrAdmin, (0, http_decorator_1.requireParam)('id'), feeController.recordPayment);
feeRouter.patch('/:id/status', ...ownerOrAdmin, (0, http_decorator_1.requireParam)('id'), (0, validate_dto_middleware_1.validateDto)(update_fee_status_dto_1.UpdateFeeStatusDto), feeController.updateStatus);
