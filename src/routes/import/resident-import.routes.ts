// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident-import.routes.ts
// PURPOSE: Import Residents endpoints (background CSV): template, upload,
//          history, detail, plan limits.
// ──────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { residentImportController } from '../../controller/import/resident-import.controller';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { requireParam } from '../../decorators/http.decorator';
import { uploadResidentCsv } from '../../middleware/upload.middleware';
import { resolveHostelId } from '../../middleware/hostel-context.middleware';

const residentImportRouter: Router = Router();

residentImportRouter.use(authenticate, requireRoles(IROLES.OWNER, IROLES.ADMIN));

residentImportRouter.get('/template', residentImportController.downloadTemplate);
residentImportRouter.get('/plan-limits', residentImportController.getPlanLimits);
residentImportRouter.get('/', residentImportController.getHistory);
residentImportRouter.post(
  '/',
  resolveHostelId,
  uploadResidentCsv,
  residentImportController.startImport,
);
residentImportRouter.get('/:id', requireParam('id'), residentImportController.getDetail);

export { residentImportRouter };
