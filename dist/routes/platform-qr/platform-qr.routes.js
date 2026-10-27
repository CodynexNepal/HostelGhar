"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.routes.ts
// PURPOSE: REST routes for Hostel Ghar PLATFORM checkout QRs (eSewa / Khalti /
//          Bank) that owners scan on `/subscription`.
//            • platformQrAdminRouter  → mounted under /admin (auth + ADMIN role)
//              GET    /admin/platform-qrs        list all
//              POST   /admin/platform-qrs        create/upsert (multipart `qrImage` or JSON url)
//              PUT    /admin/platform-qrs/:id    replace image/label
//              DELETE /admin/platform-qrs/:id    remove
//            • platformQrPublicRouter → mounted at / (owner reads active QRs)
//              GET    /platform-qrs              active checkout QRs
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformQrPublicRouter = exports.platformQrAdminRouter = void 0;
const express_1 = require("express");
const platform_qr_factory_1 = require("../../factory/platform-qr/platform-qr.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const create_platform_qr_dto_1 = require("../../dto/platform-qr/create-platform-qr.dto");
const update_platform_qr_dto_1 = require("../../dto/platform-qr/update-platform-qr.dto");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const http_decorator_1 = require("../../decorators/http.decorator");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
// ─── Admin CRUD (auth + ADMIN role applied by admin.routes.ts) ───────────────
const platformQrAdminRouter = (0, express_1.Router)();
exports.platformQrAdminRouter = platformQrAdminRouter;
const adminController = platform_qr_factory_1.PlatformQrFactory.create();
platformQrAdminRouter.get('/', adminController.listAll);
platformQrAdminRouter.post('/', upload_middleware_1.uploadPlatformQr, (0, upload_middleware_1.stripFileFields)('qrImage', 'qr', 'image', 'file', 'qrCode'), (0, validate_dto_middleware_1.validateDto)(create_platform_qr_dto_1.CreatePlatformQrDto), adminController.create);
platformQrAdminRouter.put('/:id', (0, http_decorator_1.requireParam)('id'), upload_middleware_1.uploadPlatformQr, (0, upload_middleware_1.stripFileFields)('qrImage', 'qr', 'image', 'file', 'qrCode'), (0, validate_dto_middleware_1.validateDto)(update_platform_qr_dto_1.UpdatePlatformQrDto), adminController.update);
platformQrAdminRouter.delete('/:id', (0, http_decorator_1.requireParam)('id'), adminController.remove);
// ─── Public/owner read (active QRs for the Subscription checkout) ────────────
const platformQrPublicRouter = (0, express_1.Router)();
exports.platformQrPublicRouter = platformQrPublicRouter;
const publicController = platform_qr_factory_1.PlatformQrFactory.create();
// Any authenticated owner/admin can read the active checkout QRs. Kept
// authenticated (not fully public) so the platform's accounts aren't exposed
// to anonymous scraping; residents are excluded since only owners pay.
platformQrPublicRouter.get(['/', '/platform-qrs'], auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), publicController.listActive);
