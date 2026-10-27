"use strict";
// ─────────────────────────────────────────────────────────────
// FILE: payment-proof.routes.ts
// ─────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentProofRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const create_payment_proof_dto_1 = require("../../dto/payment-proof/create-payment-proof.dto");
const review_payment_proof_dto_1 = require("../../dto/payment-proof/review-payment-proof.dto");
const payment_proof_factory_1 = require("../../factory/payment-proof/payment-proof.factory");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const http_decorator_1 = require("../../decorators/http.decorator");
const paymentProofRouter = (0, express_1.Router)();
exports.paymentProofRouter = paymentProofRouter;
const paymentProofController = payment_proof_factory_1.PaymentProofFactory.create();
paymentProofRouter.use(auth_middleware_1.authenticate);
paymentProofRouter.post('/fees/:feeId/payment-proofs', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.RESIDENT, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('feeId'), upload_middleware_1.uploadPaymentProof, (0, upload_middleware_1.stripFileFields)('screenshot', 'receipt', 'image', 'file', 'hostelId'), (0, validate_dto_middleware_1.validateDto)(create_payment_proof_dto_1.CreatePaymentProofDto), paymentProofController.submitProof);
paymentProofRouter.get('/payment-proofs/mine', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.RESIDENT, roles_enum_1.IROLES.ADMIN), paymentProofController.listMyProofs);
paymentProofRouter.get('/payment-proofs/hostels/:hostelId', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('hostelId'), paymentProofController.listHostelProofs);
// Alias: clients that group proof queries under `/fees` call
// GET /fees/hostels/:hostelId/payment-proofs. This router is mounted at `/`
// BEFORE feeRouter (`/fees`), so the longer path resolves here and never
// reaches feeRouter's GET /hostels/:hostelId.
paymentProofRouter.get('/fees/hostels/:hostelId/payment-proofs', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('hostelId'), paymentProofController.listHostelProofs);
paymentProofRouter.get('/fees/:feeId/payment-proofs', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.RESIDENT, roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('feeId'), paymentProofController.listFeeProofs);
paymentProofRouter.patch('/payment-proofs/:id/review', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('id'), (0, validate_dto_middleware_1.validateDto)(review_payment_proof_dto_1.ReviewPaymentProofDto), paymentProofController.reviewProof);
