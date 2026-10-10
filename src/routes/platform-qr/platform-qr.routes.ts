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

import { Router } from 'express';
import { PlatformQrFactory } from '../../factory/platform-qr/platform-qr.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreatePlatformQrDto } from '../../dto/platform-qr/create-platform-qr.dto';
import { UpdatePlatformQrDto } from '../../dto/platform-qr/update-platform-qr.dto';
import { uploadPlatformQr, stripFileFields } from '../../middleware/upload.middleware';
import { requireParam } from '../../decorators/http.decorator';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';

// ─── Admin CRUD (auth + ADMIN role applied by admin.routes.ts) ───────────────
const platformQrAdminRouter = Router();
const adminController = PlatformQrFactory.create();

platformQrAdminRouter.get('/', adminController.listAll);

platformQrAdminRouter.post(
  '/',
  uploadPlatformQr,
  stripFileFields('qrImage', 'qr', 'image', 'file', 'qrCode'),
  validateDto(CreatePlatformQrDto),
  adminController.create,
);

platformQrAdminRouter.put(
  '/:id',
  requireParam('id'),
  uploadPlatformQr,
  stripFileFields('qrImage', 'qr', 'image', 'file', 'qrCode'),
  validateDto(UpdatePlatformQrDto),
  adminController.update,
);

platformQrAdminRouter.delete('/:id', requireParam('id'), adminController.remove);

// ─── Public/owner read (active QRs for the Subscription checkout) ────────────
const platformQrPublicRouter = Router();
const publicController = PlatformQrFactory.create();

// Any authenticated owner/admin can read the active checkout QRs. Kept
// authenticated (not fully public) so the platform's accounts aren't exposed
// to anonymous scraping; residents are excluded since only owners pay.
platformQrPublicRouter.get(
  '/platform-qrs',
  authenticate,
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  publicController.listActive,
);

export { platformQrAdminRouter, platformQrPublicRouter };
