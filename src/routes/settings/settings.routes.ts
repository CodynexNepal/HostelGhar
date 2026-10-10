// ──────────────────────────────────────────────────────────────────────────────
// FILE: settings.routes.ts
// PURPOSE: Admin platform settings endpoints (GET + PUT per section).
//          Mounted under /admin by admin.routes.ts.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { SettingsFactory } from '../../factory/settings/settings.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { UpdateGeneralSettingsDto } from '../../dto/admin/update-general-settings.dto';
import { UpdateBillingSettingsDto } from '../../dto/admin/update-billing-settings.dto';
import { UpdateAccessSettingsDto } from '../../dto/admin/update-access-settings.dto';
import { UpdateAlertsSettingsDto } from '../../dto/admin/update-alerts-settings.dto';
import { UpdateSystemSettingsDto } from '../../dto/admin/update-system-settings.dto';

const settingsRouter: Router = Router();
const settingsController = SettingsFactory.create();

settingsRouter.get('/', settingsController.getAll);
settingsRouter.get('/:section', settingsController.getSection);

settingsRouter.put(
  '/general',
  validateDto(UpdateGeneralSettingsDto),
  settingsController.updateSection('general'),
);
settingsRouter.put(
  '/billing',
  validateDto(UpdateBillingSettingsDto),
  settingsController.updateSection('billing'),
);
settingsRouter.put(
  '/access',
  validateDto(UpdateAccessSettingsDto),
  settingsController.updateSection('access'),
);
settingsRouter.put(
  '/alerts',
  validateDto(UpdateAlertsSettingsDto),
  settingsController.updateSection('alerts'),
);
settingsRouter.put(
  '/system',
  validateDto(UpdateSystemSettingsDto),
  settingsController.updateSection('system'),
);

export { settingsRouter };
