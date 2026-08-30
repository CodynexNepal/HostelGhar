// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident.routes.ts
// PURPOSE: Resident endpoints: apply for leaves, view leave status, view fees & dues.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { ResidentFactory } from '../../factory/resident/resident.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { ApplyLeaveDto } from '../../dto/leave/apply-leave.dto';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';

const residentRouter: Router = Router();
const residentController = ResidentFactory.create();

// Protect resident routes
residentRouter.use(authenticate, requireRoles(IROLES.RESIDENT, IROLES.ADMIN));

residentRouter.post('/leaves/apply', validateDto(ApplyLeaveDto), residentController.applyForLeave);
residentRouter.get('/leaves', residentController.getMyLeaves);
residentRouter.get('/fees', residentController.getMyFees);

export { residentRouter };
