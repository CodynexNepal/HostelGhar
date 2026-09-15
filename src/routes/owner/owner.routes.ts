// ──────────────────────────────────────────────────────────────────────────────
// FILE: owner.routes.ts
// PURPOSE: Owner endpoints: dashboard, add residents, logo upload, student photo & doc upload.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { OwnerFactory } from '../../factory/owner/owner.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreateResidentDto } from '../../dto/resident/create-resident.dto';
import { CreateLeaveTypeDto } from '../../dto/leave/create-leave-type.dto';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { requireParam } from '../../decorators/http.decorator';
import {
  uploadHostelLogo,
  uploadStudentPhoto,
  uploadStudentDocument,
} from '../../middleware/upload.middleware';
import { resolveHostelId } from '../../middleware/hostel-context.middleware';

const ownerRouter: Router = Router();
const ownerController = OwnerFactory.create();

// Protect all owner routes
ownerRouter.use(authenticate, requireRoles(IROLES.OWNER, IROLES.ADMIN));

ownerRouter.get('/dashboard', ownerController.getMyHostelsDashboard);
// DEBUG: remove before production — explains empty rooms dropdowns/lists.
ownerRouter.get('/debug/rooms-count', ownerController.debugRoomsCount);
ownerRouter.get('/residents/form-options/hostels', ownerController.getResidentFormHostels);
ownerRouter.get('/residents/form-options/flats', ownerController.getResidentFormFlats);
ownerRouter.get('/residents/form-options/rooms/detail', ownerController.getResidentFormRoomDetail);
ownerRouter.get('/residents/form-options/rooms', ownerController.getResidentFormRooms);
ownerRouter.get('/residents', ownerController.getResidents);
ownerRouter.post(
  '/residents',
  resolveHostelId,
  validateDto(CreateResidentDto),
  ownerController.createResident,
);
ownerRouter.post('/leave-types', validateDto(CreateLeaveTypeDto), ownerController.createLeaveType);
ownerRouter.post('/fees/generate-now', ownerController.triggerMonthlyFees);

// ─── Cloudinary Media Upload Routes ──────────────────────────────────────────
// 1. Upload/Replace Hostel Logo
ownerRouter.post(
  '/hostels/:id/logo',
  requireParam('id'),
  uploadHostelLogo,
  ownerController.uploadHostelLogo,
);

// 2. Upload/Replace Student/Resident Profile Photo
ownerRouter.post(
  '/residents/:id/photo',
  requireParam('id'),
  uploadStudentPhoto,
  ownerController.uploadResidentPhoto,
);

// 3. Upload/Replace Student/Resident ID Document
ownerRouter.post(
  '/residents/:id/document',
  requireParam('id'),
  uploadStudentDocument,
  ownerController.uploadResidentDocument,
);

export { ownerRouter };
