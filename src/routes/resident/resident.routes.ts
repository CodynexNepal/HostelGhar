// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident.routes.ts
// PURPOSE: Resident endpoints: leaves, fees, student photo & document upload.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { ResidentFactory } from '../../factory/resident/resident.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { ApplyLeaveDto } from '../../dto/leave/apply-leave.dto';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { uploadStudentPhoto, uploadStudentDocument } from '../../middleware/upload.middleware';
import { AttendanceFactory } from '../../factory/attendance/attendance.factory';
import { CheckOutAttendanceDto, MarkAttendanceDto } from '../../dto/attendance/mark-attendance.dto';
import { paymentController } from '../../controller/payment/payment.controller';
import { RecordPaymentDto } from '../../dto/payment/record-payment.dto';
import { requireParam } from '../../decorators/http.decorator';

const residentRouter: Router = Router();
const residentController = ResidentFactory.create();
const attendanceController = AttendanceFactory.create();

// Protect resident routes
residentRouter.use(authenticate, requireRoles(IROLES.RESIDENT, IROLES.ADMIN));

residentRouter.get('/me', residentController.getMyProfile);
residentRouter.post('/leaves/apply', validateDto(ApplyLeaveDto), residentController.applyForLeave);
residentRouter.get('/leaves', residentController.getMyLeaves);
residentRouter.get('/fees', residentController.getMyFees);
residentRouter.get('/fees/:id', requireParam('id'), paymentController.getInvoice);
residentRouter.post(
  '/fees/:id/pay',
  requireParam('id'),
  validateDto(RecordPaymentDto),
  paymentController.residentPay,
);
residentRouter.get('/payments', paymentController.getResidentPayments);
residentRouter.get('/payment-qrs', residentController.getMyPaymentQrs);

// ─── Attendance (self check-in) ──────────────────────────────────────────────
// Resident marks self PRESENT/LATE for today (Nepal date). One record per
// resident per day — repeat check-ins return 409.
residentRouter.post(
  '/attendance/check-in',
  validateDto(MarkAttendanceDto),
  attendanceController.checkIn,
);
residentRouter.post(
  '/attendance/check-out',
  validateDto(CheckOutAttendanceDto),
  attendanceController.checkOut,
);
residentRouter.get('/attendance', attendanceController.getMyAttendance);

// ─── Student Self-Service Media Upload Routes ────────────────────────────────
// 1. Upload/Update own student photo
residentRouter.post('/profile/photo', uploadStudentPhoto, residentController.uploadMyPhoto);

// 2. Upload/Update own student identification document
residentRouter.post(
  '/profile/document',
  uploadStudentDocument,
  residentController.uploadMyDocument,
);

export { residentRouter };
