"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.controller.ts
// PURPOSE: HTTP layer for attendance — owner/admin listing and resident
//          self check-in / check-out / history with geofencing & IP geolocation.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const attendance_enum_1 = require("../../enum/attendance.enum");
const createHttpError_1 = require("../../utils/createHttpError");
const pagination_util_1 = require("../../utils/pagination.util");
const geolocation_util_1 = require("../../utils/geolocation.util");
class AttendanceController {
    constructor(attendanceService) {
        this.attendanceService = attendanceService;
        /**
         * GET /owner/attendance?hostelId=&residentId=&date=&status=&page=&limit=
         * Owner/Admin: attendance records for a hostel (or all owned hostels) with summary.
         */
        this.list = async (req, res, next) => {
            try {
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const headerHostel = typeof req.headers['x-hostel-id'] === 'string' ? req.headers['x-hostel-id'] : undefined;
                const queryHostel = typeof req.query.hostelId === 'string' ? req.query.hostelId.trim() : undefined;
                const result = await this.attendanceService.list(req.user.userId, req.user.role, {
                    page,
                    limit,
                    hostelId: queryHostel ?? headerHostel,
                    residentId: typeof req.query.residentId === 'string' ? req.query.residentId.trim() : undefined,
                    date: typeof req.query.date === 'string' ? req.query.date.trim() : undefined,
                    status: this.enumQuery(req.query.status),
                });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * POST /resident/attendance/check-in
         * Resident: marks self PRESENT/LATE for today (Nepal date).
         */
        this.checkIn = async (req, res, next) => {
            try {
                const clientIp = (0, geolocation_util_1.extractClientIp)(req);
                const data = await this.attendanceService.checkIn(req.user.userId, req.body, clientIp);
                res
                    .status(statusCode_interface_1.STATUS_CODE.CREATED)
                    .json({ success: true, message: 'Checked in successfully', data });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * POST /resident/attendance/check-out
         * Resident: marks self checked out for today (Nepal date).
         */
        this.checkOut = async (req, res, next) => {
            try {
                const clientIp = (0, geolocation_util_1.extractClientIp)(req);
                const data = await this.attendanceService.checkOut(req.user.userId, req.body, clientIp);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, message: 'Checked out successfully', data });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /resident/attendance — the resident's own attendance history.
         */
        this.getMyAttendance = async (req, res, next) => {
            try {
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const result = await this.attendanceService.getMyAttendance(req.user.userId, page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
    }
    enumQuery(value) {
        if (typeof value !== 'string' || value.trim() === '')
            return undefined;
        const normalized = value
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, '_');
        if (!(normalized in attendance_enum_1.AttendanceStatus)) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'status must be one of: PRESENT, ABSENT, LATE, HALF_DAY, ON_LEAVE');
        }
        return normalized;
    }
}
exports.AttendanceController = AttendanceController;
