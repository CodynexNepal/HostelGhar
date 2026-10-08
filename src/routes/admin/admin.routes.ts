// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.routes.ts
// PURPOSE: Admin endpoints: hostel creation, list hostels, assign owners, logo upload.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { AdminFactory } from '../../factory/admin/admin.factory';
import { AnalyticsFactory } from '../../factory/analytics/analytics.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreateHostelDto } from '../../dto/hostel/create-hostel.dto';
import { AssignHostelOwnerDto } from '../../dto/admin/assign-hostel-owner.dto';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { requireParam } from '../../decorators/http.decorator';
import {
  uploadHostelLogo,
  uploadOwnerImage,
  normalizeOwnerFields,
  stripFileFields,
} from '../../middleware/upload.middleware';
import { CreateOwnerDto } from '../../dto/admin/create-owner.dto';
import { SuspendHostelDto } from '../../dto/admin/suspend-hostel.dto';

const adminRouter: Router = Router();
const adminController = AdminFactory.create();
const analyticsController = AnalyticsFactory.create();

// Protect all admin routes with JWT auth and Admin role check
adminRouter.use(authenticate, requireRoles(IROLES.ADMIN));

// Single-call bootstrap for every card on the admin dashboard page.
// `?refresh=1` forces a live DB read instead of the cached snapshot.
adminRouter.get('/dashboard', analyticsController.adminDashboard);
adminRouter.get('/dashboard/summary', analyticsController.adminSummary);
adminRouter.post(
  '/owners',
  uploadOwnerImage,
  normalizeOwnerFields,
  stripFileFields('image'),
  validateDto(CreateOwnerDto),
  adminController.createOwner,
);
adminRouter.post('/cache/hostels/invalidate', adminController.invalidateHostelCache);

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

// Suspend / reactivate a hostel (admin only). Frontend calls
// POST /admin/hostels/:id/suspend with optional { reason }.
adminRouter.post(
  '/hostels/:id/suspend',
  requireParam('id'),
  validateDto(SuspendHostelDto),
  adminController.suspendHostel,
);

adminRouter.post('/hostels/:id/reactivate', requireParam('id'), adminController.reactivateHostel);

export { adminRouter };
