"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: owner.routes.ts
// PURPOSE: Owner endpoints: dashboard, add residents, logo upload, student photo & doc upload.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerRouter = void 0;
const express_1 = require("express");
const owner_factory_1 = require("../../factory/owner/owner.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const create_resident_dto_1 = require("../../dto/resident/create-resident.dto");
const create_leave_type_dto_1 = require("../../dto/leave/create-leave-type.dto");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const http_decorator_1 = require("../../decorators/http.decorator");
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const hostel_context_middleware_1 = require("../../middleware/hostel-context.middleware");
const attendance_factory_1 = require("../../factory/attendance/attendance.factory");
const ownerRouter = (0, express_1.Router)();
exports.ownerRouter = ownerRouter;
const ownerController = owner_factory_1.OwnerFactory.create();
const attendanceController = attendance_factory_1.AttendanceFactory.create();
// Protect all owner routes
ownerRouter.use(auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN));
ownerRouter.get('/dashboard', ownerController.getMyHostelsDashboard);
// DEBUG: remove before production — explains empty rooms dropdowns/lists.
ownerRouter.get('/debug/rooms-count', ownerController.debugRoomsCount);
ownerRouter.get('/residents/form-options/hostels', ownerController.getResidentFormHostels);
ownerRouter.get('/residents/form-options/flats', ownerController.getResidentFormFlats);
ownerRouter.get('/residents/form-options/rooms/detail', ownerController.getResidentFormRoomDetail);
ownerRouter.get('/residents/form-options/rooms', ownerController.getResidentFormRooms);
ownerRouter.get('/residents', ownerController.getResidents);
ownerRouter.post('/residents', hostel_context_middleware_1.resolveHostelId, (0, validate_dto_middleware_1.validateDto)(create_resident_dto_1.CreateResidentDto), ownerController.createResident);
ownerRouter.post('/leave-types', (0, validate_dto_middleware_1.validateDto)(create_leave_type_dto_1.CreateLeaveTypeDto), ownerController.createLeaveType);
ownerRouter.post('/fees/generate-now', ownerController.triggerMonthlyFees);
// ─── Attendance ──────────────────────────────────────────────────────────────
// Owner/Admin views attendance for a hostel (?hostelId=) or all owned hostels.
// Supports ?residentId=, ?date=YYYY-MM-DD, ?status=PRESENT|ABSENT|LATE|...
ownerRouter.get('/attendance', rateLimiter_config_1.apiReadLimiter, attendanceController.list);
// ─── Cloudinary Media Upload Routes ──────────────────────────────────────────
// 1. Upload/Replace Hostel Logo
ownerRouter.post('/hostels/:id/logo', (0, http_decorator_1.requireParam)('id'), upload_middleware_1.uploadHostelLogo, ownerController.uploadHostelLogo);
// 2. Upload/Replace Student/Resident Profile Photo
ownerRouter.post('/residents/:id/photo', (0, http_decorator_1.requireParam)('id'), upload_middleware_1.uploadStudentPhoto, ownerController.uploadResidentPhoto);
// 3. Upload/Replace Student/Resident ID Document
ownerRouter.post('/residents/:id/document', (0, http_decorator_1.requireParam)('id'), upload_middleware_1.uploadStudentDocument, ownerController.uploadResidentDocument);
