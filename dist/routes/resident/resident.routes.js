"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident.routes.ts
// PURPOSE: Resident endpoints: leaves, fees, student photo & document upload.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.residentRouter = void 0;
const express_1 = require("express");
const resident_factory_1 = require("../../factory/resident/resident.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const apply_leave_dto_1 = require("../../dto/leave/apply-leave.dto");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const attendance_factory_1 = require("../../factory/attendance/attendance.factory");
const mark_attendance_dto_1 = require("../../dto/attendance/mark-attendance.dto");
const payment_controller_1 = require("../../controller/payment/payment.controller");
const record_payment_dto_1 = require("../../dto/payment/record-payment.dto");
const http_decorator_1 = require("../../decorators/http.decorator");
const residentRouter = (0, express_1.Router)();
exports.residentRouter = residentRouter;
const residentController = resident_factory_1.ResidentFactory.create();
const attendanceController = attendance_factory_1.AttendanceFactory.create();
// Protect resident routes
residentRouter.use(auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.RESIDENT, roles_enum_1.IROLES.ADMIN));
residentRouter.get('/me', residentController.getMyProfile);
residentRouter.post('/leaves/apply', (0, validate_dto_middleware_1.validateDto)(apply_leave_dto_1.ApplyLeaveDto), residentController.applyForLeave);
residentRouter.get('/leaves', residentController.getMyLeaves);
residentRouter.get('/fees', residentController.getMyFees);
residentRouter.get('/fees/:id', (0, http_decorator_1.requireParam)('id'), payment_controller_1.paymentController.getInvoice);
residentRouter.post('/fees/:id/pay', (0, http_decorator_1.requireParam)('id'), (0, validate_dto_middleware_1.validateDto)(record_payment_dto_1.RecordPaymentDto), payment_controller_1.paymentController.residentPay);
residentRouter.get('/payments', payment_controller_1.paymentController.getResidentPayments);
residentRouter.get('/payment-qrs', residentController.getMyPaymentQrs);
// ─── Attendance (self check-in) ──────────────────────────────────────────────
// Resident marks self PRESENT/LATE for today (Nepal date). One record per
// resident per day — repeat check-ins return 409.
residentRouter.post('/attendance/check-in', (0, validate_dto_middleware_1.validateDto)(mark_attendance_dto_1.MarkAttendanceDto), attendanceController.checkIn);
residentRouter.post('/attendance/check-out', attendanceController.checkOut);
residentRouter.get('/attendance', attendanceController.getMyAttendance);
// ─── Student Self-Service Media Upload Routes ────────────────────────────────
// 1. Upload/Update own student photo
residentRouter.post('/profile/photo', upload_middleware_1.uploadStudentPhoto, residentController.uploadMyPhoto);
// 2. Upload/Update own student identification document
residentRouter.post('/profile/document', upload_middleware_1.uploadStudentDocument, residentController.uploadMyDocument);
