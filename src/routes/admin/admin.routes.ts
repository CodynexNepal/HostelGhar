// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.routes.ts
// PURPOSE: Admin endpoints: hostel creation, list hostels, assign owners.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { AdminFactory } from '../../factory/admin/admin.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreateHostelDto } from '../../dto/hostel/create-hostel.dto';
import { AssignHostelOwnerDto } from '../../dto/admin/assign-hostel-owner.dto';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { requireParam } from '../../decorators/http.decorator';

const adminRouter: Router = Router();
const adminController = AdminFactory.create();

// Protect all admin routes with JWT auth and Admin role check
adminRouter.use(authenticate, requireRoles(IROLES.ADMIN));

adminRouter.post('/hostels', validateDto(CreateHostelDto), adminController.createHostel);
adminRouter.get('/hostels', adminController.getAllHostels);
adminRouter.put(
  '/hostels/:id/owner',
  requireParam('id'),
  validateDto(AssignHostelOwnerDto),
  adminController.assignHostelOwner,
);

export { adminRouter };
