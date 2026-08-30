// ──────────────────────────────────────────────────────────────────────────────
// FILE: owner.routes.ts
// PURPOSE: Owner endpoints: dashboard, add residents, create leave types, trigger fees.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { OwnerFactory } from '../../factory/owner/owner.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreateResidentDto } from '../../dto/resident/create-resident.dto';
import { CreateLeaveTypeDto } from '../../dto/leave/create-leave-type.dto';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';

const ownerRouter: Router = Router();
const ownerController = OwnerFactory.create();

// Protect all owner routes
ownerRouter.use(authenticate, requireRoles(IROLES.OWNER, IROLES.ADMIN));

ownerRouter.get('/dashboard', ownerController.getMyHostelsDashboard);
ownerRouter.post('/residents', validateDto(CreateResidentDto), ownerController.createResident);
ownerRouter.post('/leave-types', validateDto(CreateLeaveTypeDto), ownerController.createLeaveType);
ownerRouter.post('/fees/generate-now', ownerController.triggerMonthlyFees);

export { ownerRouter };
