"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.routes.ts
// PURPOSE: Admin endpoints: hostel creation, list hostels, assign owners, logo upload.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const admin_factory_1 = require("../../factory/admin/admin.factory");
const analytics_factory_1 = require("../../factory/analytics/analytics.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const create_hostel_dto_1 = require("../../dto/hostel/create-hostel.dto");
const assign_hostel_owner_dto_1 = require("../../dto/admin/assign-hostel-owner.dto");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const http_decorator_1 = require("../../decorators/http.decorator");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const create_owner_dto_1 = require("../../dto/admin/create-owner.dto");
const suspend_hostel_dto_1 = require("../../dto/admin/suspend-hostel.dto");
const settings_routes_1 = require("../settings/settings.routes");
const platform_qr_routes_1 = require("../platform-qr/platform-qr.routes");
const adminRouter = (0, express_1.Router)();
exports.adminRouter = adminRouter;
const adminController = admin_factory_1.AdminFactory.create();
const analyticsController = analytics_factory_1.AnalyticsFactory.create();
// Protect all admin routes with JWT auth and Admin role check
adminRouter.use(auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN));
// Platform settings (GET + PUT per section: general | billing | access | alerts | system)
adminRouter.use('/settings', settings_routes_1.settingsRouter);
// Platform checkout QRs owners scan on /subscription (admin CRUD: list/create/update/delete)
adminRouter.use('/platform-qrs', platform_qr_routes_1.platformQrAdminRouter);
// Single-call bootstrap for every card on the admin dashboard page.
// `?refresh=1` forces a live DB read instead of the cached snapshot.
adminRouter.get('/dashboard', analyticsController.adminDashboard);
adminRouter.get('/dashboard/summary', analyticsController.adminSummary);
adminRouter.post('/owners', upload_middleware_1.uploadOwnerImage, upload_middleware_1.normalizeOwnerFields, (0, upload_middleware_1.stripFileFields)('image'), (0, validate_dto_middleware_1.validateDto)(create_owner_dto_1.CreateOwnerDto), adminController.createOwner);
adminRouter.post('/cache/hostels/invalidate', adminController.invalidateHostelCache);
// NOTE: `logo`/`image` arrive as FILE parts (multer → req.files → Cloudinary),
// never as body strings. `stripFileFields` drops any stray text part with the
// same name BEFORE validateDto, so class-validator never sees a `logo` string
// ("must be a string / shorter than 500 chars" / "should not exist").
adminRouter.post('/hostels', upload_middleware_1.uploadHostelLogo, (0, upload_middleware_1.stripFileFields)('logo', 'image'), (0, validate_dto_middleware_1.validateDto)(create_hostel_dto_1.CreateHostelDto), adminController.createHostel);
adminRouter.get('/hostels', adminController.getAllHostels);
adminRouter.put('/hostels/:id/owner', (0, http_decorator_1.requireParam)('id'), (0, validate_dto_middleware_1.validateDto)(assign_hostel_owner_dto_1.AssignHostelOwnerDto), adminController.assignHostelOwner);
// Upload or replace hostel logo
adminRouter.post('/hostels/:id/logo', (0, http_decorator_1.requireParam)('id'), upload_middleware_1.uploadHostelLogo, adminController.uploadLogo);
// Suspend / reactivate a hostel (admin only). Frontend calls
// POST /admin/hostels/:id/suspend with optional { reason }.
adminRouter.post('/hostels/:id/suspend', (0, http_decorator_1.requireParam)('id'), (0, validate_dto_middleware_1.validateDto)(suspend_hostel_dto_1.SuspendHostelDto), adminController.suspendHostel);
adminRouter.post('/hostels/:id/reactivate', (0, http_decorator_1.requireParam)('id'), adminController.reactivateHostel);
