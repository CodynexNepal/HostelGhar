// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.routes.ts
// PURPOSE: Admin endpoints: hostel creation, list hostels, assign owners, logo upload.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { AdminFactory } from '../../factory/admin/admin.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreateHostelDto } from '../../dto/hostel/create-hostel.dto';
import { AssignHostelOwnerDto } from '../../dto/admin/assign-hostel-owner.dto';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { requireParam } from '../../decorators/http.decorator';
import { uploadHostelLogo, stripFileFields } from '../../middleware/upload.middleware';

const adminRouter: Router = Router();
const adminController = AdminFactory.create();

// Protect all admin routes with JWT auth and Admin role check
adminRouter.use(authenticate, requireRoles(IROLES.ADMIN));

// NOTE: `logo`/`image` arrive as FILE parts (multer → req.files → Cloudinary),
// never as body strings. `stripFileFields` drops any stray text part with the
// same name BEFORE validateDto, so class-validator never sees a `logo` string
// ("must be a string / shorter than 500 chars" / "should not exist").
adminRouter.post(
  '/hostels',
  uploadHostelLogo,
  stripFileFields('logo', 'image'),
  validateDto(CreateHostelDto),
  adminController.createHostel,
);

adminRouter.get('/hostels', adminController.getAllHostels);
adminRouter.put(
  '/hostels/:id/owner',
  requireParam('id'),
  validateDto(AssignHostelOwnerDto),
  adminController.assignHostelOwner,
);

// Upload or replace hostel logo
adminRouter.post(
  '/hostels/:id/logo',
  requireParam('id'),
  uploadHostelLogo,
  adminController.uploadLogo,
);

export { adminRouter };
