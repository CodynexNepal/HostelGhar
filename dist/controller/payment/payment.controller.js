"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.controller.ts
// PURPOSE: HTTP controllers for recording payments, retrieving audit history,
//          downloading receipts, and managing overdue balances.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentController = exports.PaymentController = void 0;
const payment_service_1 = require("../../services/payment/payment.service");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
const pagination_util_1 = require("../../utils/pagination.util");
class PaymentController {
    constructor(service = payment_service_1.paymentService) {
        this.service = service;
        /**
         * POST /fees/:id/payments
         * Owner/Admin records a manual or cash payment against an invoice.
         */
        this.recordPayment = async (req, res, next) => {
            try {
                const feeId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const body = req.body;
                const result = await this.service.recordPayment(req.user.userId, req.user.role, feeId, body);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: result.isDuplicate
                        ? 'Duplicate payment request: already processed'
                        : 'Payment recorded successfully',
                    data: result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * POST /resident/fees/:id/pay
         * Resident initiates/records payment against their own fee.
         */
        this.residentPay = async (req, res, next) => {
            try {
                const feeId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const body = req.body;
                const result = await this.service.recordPayment(req.user.userId, req.user.role, feeId, body);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: result.isDuplicate
                        ? 'Payment was already processed'
                        : 'Payment processed successfully',
                    data: result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /fees/:id
         * Detailed invoice data with payment transaction history.
         */
        this.getInvoice = async (req, res, next) => {
            try {
                const feeId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const fee = await this.service.getInvoiceDetails(req.user.userId, req.user.role, feeId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: fee,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /fees/hostels/:hostelId/payments
         * Lists all payment transactions for a hostel with search, date & method filters.
         */
        this.getHostelPayments = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const filters = {
                    status: req.query.status,
                    paymentMethod: req.query.method,
                    startDate: req.query.startDate,
                    endDate: req.query.endDate,
                    search: req.query.search,
                };
                const result = await this.service.getHostelPayments(req.user.userId, req.user.role, hostelId, page, limit, filters);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    ...result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /resident/payments
         * Returns student's individual payment transaction history.
         */
        this.getResidentPayments = async (req, res, next) => {
            try {
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const result = await this.service.getResidentPayments(req.user.userId, page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    ...result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /payments/:id/receipt
         * Download / print receipt payload for an authorized payment.
         */
        this.getReceipt = async (req, res, next) => {
            try {
                const paymentId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const receipt = await this.service.getReceipt(req.user.userId, req.user.role, paymentId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: receipt,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * POST /fees/sync-overdue
         * Evaluates due dates and updates overdue statuses.
         */
        this.syncOverdue = async (req, res, next) => {
            try {
                const hostelId = req.query.hostelId;
                const count = await this.service.syncOverdueFees(hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: `Synced ${count} overdue invoice(s)`,
                    count,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.PaymentController = PaymentController;
exports.paymentController = new PaymentController();
