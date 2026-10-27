"use strict";
// ─────────────────────────────────────────────────────────────
// FILE: payment-proof.controller.ts
// PURPOSE: HTTP layer for payment proofs.
// ─────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentProofController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const payment_proof_service_1 = require("../../services/payment-proof/payment-proof.service");
const payment_proof_enum_1 = require("../../enum/payment-proof.enum");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const pagination_util_1 = require("../../utils/pagination.util");
const http_decorator_1 = require("../../decorators/http.decorator");
class PaymentProofController {
    constructor(proofService = new payment_proof_service_1.PaymentProofService()) {
        this.proofService = proofService;
        this.submitProof = async (req, res, next) => {
            try {
                const feeId = (0, http_decorator_1.getRequiredParam)(req, 'feeId');
                const dto = req.body;
                const file = (0, upload_middleware_1.pickPaymentProofFile)(req);
                const data = await this.proofService.submitProof(req.user.userId, req.user.role, feeId, dto, file);
                res
                    .status(statusCode_interface_1.STATUS_CODE.CREATED)
                    .json({ success: true, message: 'Payment proof submitted', data });
            }
            catch (error) {
                next(error);
            }
        };
        this.listMyProofs = async (req, res, next) => {
            try {
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const result = await this.proofService.listForResident(req.user.userId, req.user.role, {
                    page,
                    limit,
                });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.listHostelProofs = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const raw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
                const status = raw && raw in payment_proof_enum_1.PaymentProofStatus ? raw : undefined;
                const result = await this.proofService.listForHostel(req.user.userId, req.user.role, hostelId, { page, limit }, status);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.listFeeProofs = async (req, res, next) => {
            try {
                const feeId = (0, http_decorator_1.getRequiredParam)(req, 'feeId');
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const result = await this.proofService.listForFee(req.user.userId, req.user.role, feeId, {
                    page,
                    limit,
                });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.reviewProof = async (req, res, next) => {
            try {
                const id = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const dto = req.body;
                const data = await this.proofService.reviewProof(req.user.userId, req.user.role, id, dto);
                res
                    .status(statusCode_interface_1.STATUS_CODE.OK)
                    .json({ success: true, message: `Proof ${data.status.toLowerCase()}`, data });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.PaymentProofController = PaymentProofController;
