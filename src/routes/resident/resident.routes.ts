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

const residentRouter: Router = Router();
const residentController = ResidentFactory.create();

// Protect resident routes
residentRouter.use(authenticate, requireRoles(IROLES.RESIDENT, IROLES.ADMIN));

residentRouter.post('/leaves/apply', validateDto(ApplyLeaveDto), residentController.applyForLeave);
residentRouter.get('/leaves', residentController.getMyLeaves);
residentRouter.get('/fees', residentController.getMyFees);

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
