"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.controller.ts
// PURPOSE: Controller allowing users to book accommodations with pagination & 3-tier caching.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
const pagination_util_1 = require("../../utils/pagination.util");
class BookingController {
    constructor(bookingService) {
        this.bookingService = bookingService;
        /**
         * Book a hostel room (Restricted to role: 'USER' only)
         */
        this.bookHostel = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const dto = req.body;
                const result = await this.bookingService.createBooking(userId, dto.hostelId, dto.checkInDate, dto.remarks, dto.studentName, dto.phone, dto.email);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: 'Hostel booking request submitted successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Get user's bookings with 3-tier caching and pagination
         */
        this.getMyBookings = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const result = await this.bookingService.getUserBookings(userId, page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    ...result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getHostelBookings = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const result = await this.bookingService.getHostelBookings(hostelId, page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    ...result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateStatus = async (req, res, next) => {
            try {
                const bookingId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const status = req.body.status ?? req.body.bookingStatus;
                const result = await this.bookingService.updateBookingStatus(bookingId, status, req.user.userId, req.user.role);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data: result.data });
            }
            catch (error) {
                next(error);
            }
        };
        this.cancelBooking = async (req, res, next) => {
            try {
                const bookingId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const result = await this.bookingService.cancelBooking(bookingId, req.user.userId, req.user.role);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.DELETED).json({ success: true, data: result.data });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.BookingController = BookingController;
