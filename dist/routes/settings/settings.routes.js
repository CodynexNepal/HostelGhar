"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: settings.routes.ts
// PURPOSE: Admin platform settings endpoints (GET + PUT per section).
//          Mounted under /admin by admin.routes.ts.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const settings_factory_1 = require("../../factory/settings/settings.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const update_general_settings_dto_1 = require("../../dto/admin/update-general-settings.dto");
const update_billing_settings_dto_1 = require("../../dto/admin/update-billing-settings.dto");
const update_access_settings_dto_1 = require("../../dto/admin/update-access-settings.dto");
const update_alerts_settings_dto_1 = require("../../dto/admin/update-alerts-settings.dto");
const update_system_settings_dto_1 = require("../../dto/admin/update-system-settings.dto");
const settingsRouter = (0, express_1.Router)();
exports.settingsRouter = settingsRouter;
const settingsController = settings_factory_1.SettingsFactory.create();
settingsRouter.get('/', settingsController.getAll);
settingsRouter.get('/:section', settingsController.getSection);
settingsRouter.put('/general', (0, validate_dto_middleware_1.validateDto)(update_general_settings_dto_1.UpdateGeneralSettingsDto), settingsController.updateSection('general'));
settingsRouter.put('/billing', (0, validate_dto_middleware_1.validateDto)(update_billing_settings_dto_1.UpdateBillingSettingsDto), settingsController.updateSection('billing'));
settingsRouter.put('/access', (0, validate_dto_middleware_1.validateDto)(update_access_settings_dto_1.UpdateAccessSettingsDto), settingsController.updateSection('access'));
settingsRouter.put('/alerts', (0, validate_dto_middleware_1.validateDto)(update_alerts_settings_dto_1.UpdateAlertsSettingsDto), settingsController.updateSection('alerts'));
settingsRouter.put('/system', (0, validate_dto_middleware_1.validateDto)(update_system_settings_dto_1.UpdateSystemSettingsDto), settingsController.updateSection('system'));
