"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.controller.ts
// PURPOSE: HTTP Controller for Hostel Payment QR Codes (eSewa, Khalti, Bank Transfer).
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentQrController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const roles_enum_1 = require("../../enum/roles.enum");
const payment_qr_service_1 = require("../../services/payment-qr/payment-qr.service");
const upload_middleware_1 = require("../../middleware/upload.middleware");
class PaymentQrController {
    constructor(qrService = new payment_qr_service_1.PaymentQrService()) {
        this.qrService = qrService;
        /**
         * GET /payment-qrs
         * Dispatches automatically based on user role:
         * - RESIDENT: returns active QRs for resident's hostel under "My Payments"
         * - OWNER/ADMIN: returns all QRs for the specified or managed hostel
         */
        this.listPaymentQrs = async (req, res, next) => {
            try {
                const user = req.user;
                const role = user.role?.toLowerCase();
                if (role === roles_enum_1.IROLES.RESIDENT.toLowerCase()) {
                    const result = await this.qrService.getResidentPaymentQrs(user.userId);
                    res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                        success: true,
                        data: result,
                    });
                    return;
                }
                const hostelId = req.query.hostelId ||
                    req.hostelId ||
                    req.headers['x-hostel-id'];
                const isActiveFilter = req.query.isActive !== undefined
                    ? req.query.isActive === 'true' || req.query.isActive === '1'
                    : undefined;
                const result = await this.qrService.listPaymentQrsForHostel(user.userId, user.role, hostelId, isActiveFilter);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /payment-qrs/resident
         * Explicit endpoint for Resident view (used under "My Payments")
         */
        this.getResidentPaymentQrs = async (req, res, next) => {
            try {
                const user = req.user;
                const hostelId = req.query.hostelId || req.hostelId;
                const result = await this.qrService.getResidentPaymentQrs(user.userId, hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /payment-qrs/preview
         * "Preview Resident View": Allows owners/admins to preview what residents see
         */
        this.previewResidentView = async (req, res, next) => {
            try {
                const user = req.user;
                const hostelId = req.query.hostelId ||
                    req.hostelId ||
                    req.headers['x-hostel-id'];
                const result = await this.qrService.previewResidentView(user.userId, user.role, hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /payment-qrs/:id
         * Get single Payment QR by ID
         */
        this.getPaymentQrById = async (req, res, next) => {
            try {
                const user = req.user;
                const { id } = req.params;
                const qr = await this.qrService.getPaymentQrById(user.userId, user.role, id);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: qr,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * POST /payment-qrs
         * Create a new payment QR code (supports file upload or image URL)
         */
        this.createPaymentQr = async (req, res, next) => {
            try {
                const user = req.user;
                const dto = req.body;
                const file = (0, upload_middleware_1.pickPaymentQrFile)(req);
                const qr = await this.qrService.createPaymentQr(user.userId, user.role, dto, file);
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: 'Payment QR code created successfully',
                    data: qr,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * POST /payment-qrs/demo
         * "Load Demo QRs": Seeds standard eSewa, Khalti, and Bank Transfer QRs
         */
        this.loadDemoQRs = async (req, res, next) => {
            try {
                const user = req.user;
                const dto = req.body;
                const hostelId = dto?.hostelId ||
                    req.query.hostelId ||
                    req.hostelId ||
                    req.headers['x-hostel-id'];
                const result = await this.qrService.loadDemoQRs(user.userId, user.role, hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * PUT /payment-qrs/:id
         * "Replace QR" / Full Update: Replaces the QR image and/or details
         */
        this.replacePaymentQr = async (req, res, next) => {
            try {
                const user = req.user;
                const { id } = req.params;
                const dto = req.body;
                const file = (0, upload_middleware_1.pickPaymentQrFile)(req);
                const updated = await this.qrService.replacePaymentQr(user.userId, user.role, id, dto, file);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Payment QR code replaced successfully',
                    data: updated,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * PATCH /payment-qrs/:id
         * Partial update
         */
        this.patchPaymentQr = async (req, res, next) => {
            try {
                const user = req.user;
                const { id } = req.params;
                const dto = req.body;
                const file = (0, upload_middleware_1.pickPaymentQrFile)(req);
                const updated = await this.qrService.patchPaymentQr(user.userId, user.role, id, dto, file);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Payment QR code updated successfully',
                    data: updated,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * PATCH /payment-qrs/:id/toggle
         * Toggle Active / Inactive status
         */
        this.toggleStatus = async (req, res, next) => {
            try {
                const user = req.user;
                const { id } = req.params;
                const updated = await this.qrService.toggleActiveStatus(user.userId, user.role, id);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: `Payment QR code is now ${updated.isActive ? 'active' : 'inactive'}`,
                    data: updated,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * DELETE /payment-qrs/:id
         * "Remove" payment QR code
         */
        this.deletePaymentQr = async (req, res, next) => {
            try {
                const user = req.user;
                const { id } = req.params;
                const result = await this.qrService.deletePaymentQr(user.userId, user.role, id);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: result.message,
                    data: { id: result.id },
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.PaymentQrController = PaymentQrController;
