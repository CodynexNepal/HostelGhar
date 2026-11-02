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
import {
  authenticate,
  requireRoles,
  requireAdminForOwnerManagement,
} from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { requireParam } from '../../decorators/http.decorator';
import {
  uploadHostelLogo,
  uploadOwnerImage,
  normalizeOwnerFields,
  stripFileFields,
} from '../../middleware/upload.middleware';
import { CreateOwnerDto } from '../../dto/admin/create-owner.dto';
import { UpdateOwnerDto } from '../../dto/admin/update-owner.dto';
import { SuspendOwnerDto } from '../../dto/admin/suspend-owner.dto';
import { SuspendHostelDto } from '../../dto/admin/suspend-hostel.dto';
import { settingsRouter } from '../settings/settings.routes';
import { platformQrAdminRouter } from '../platform-qr/platform-qr.routes';

const adminRouter: Router = Router();
const adminController = AdminFactory.create();
const analyticsController = AnalyticsFactory.create();

// Protect all admin routes with JWT auth and Admin role check
adminRouter.use(authenticate, requireRoles(IROLES.ADMIN));

// Platform settings (GET + PUT per section: general | billing | access | alerts | system)
adminRouter.use('/settings', settingsRouter);

// Platform checkout QRs owners scan on /subscription (admin CRUD: list/create/update/delete)
adminRouter.use('/platform-qrs', platformQrAdminRouter);

// Single-call bootstrap for every card on the admin dashboard page.
// `?refresh=1` forces a live DB read instead of the cached snapshot.
adminRouter.get('/dashboard', analyticsController.adminDashboard);
adminRouter.get('/dashboard/summary', analyticsController.adminSummary);

// ─── Owner Management (Admin Only: View, Edit, Suspend, Reactivate, Delete) ──
adminRouter.get('/owners', requireAdminForOwnerManagement, adminController.getOwners);
adminRouter.get(
  '/owners/:id',
  requireAdminForOwnerManagement,
  requireParam('id'),
  adminController.getOwnerById,
);
adminRouter.post(
  '/owners',
  requireAdminForOwnerManagement,
  uploadOwnerImage,
  normalizeOwnerFields,
  stripFileFields('image'),
  validateDto(CreateOwnerDto),
  adminController.createOwner,
);
adminRouter.put(
  '/owners/:id',
  requireAdminForOwnerManagement,
  requireParam('id'),
  validateDto(UpdateOwnerDto),
  adminController.updateOwner,
);
adminRouter.put(
  '/owners/:id/plan',
  requireAdminForOwnerManagement,
  requireParam('id'),
  adminController.updateOwnerPlan,
);
adminRouter.post(
  '/owners/:id/suspend',
  requireAdminForOwnerManagement,
  requireParam('id'),
  validateDto(SuspendOwnerDto),
  adminController.suspendOwner,
);
adminRouter.post(
  '/owners/:id/reactivate',
  requireAdminForOwnerManagement,
  requireParam('id'),
  adminController.reactivateOwner,
);
adminRouter.delete(
  '/owners/:id',
  requireAdminForOwnerManagement,
  requireParam('id'),
  adminController.deleteOwner,
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
