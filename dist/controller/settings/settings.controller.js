"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: settings.controller.ts
// PURPOSE: Admin settings HTTP controller delegating entirely to SettingsService.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const VALID_SECTIONS = ['general', 'billing', 'access', 'alerts', 'system'];
class SettingsController {
    constructor(settingsService) {
        this.settingsService = settingsService;
        this.getAll = async (_req, res, next) => {
            try {
                const data = await this.settingsService.getAll();
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data });
            }
            catch (error) {
                next(error);
            }
        };
        this.getSection = async (req, res, next) => {
            try {
                const section = String(req.params.section || '').toLowerCase();
                if (!VALID_SECTIONS.includes(section)) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: `Unknown settings section "${req.params.section}". Valid sections: ${VALID_SECTIONS.join(', ')}`,
                    });
                    return;
                }
                const data = await this.settingsService.getSection(section);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateSection = (section) => {
            return async (req, res, next) => {
                try {
                    const data = await this.settingsService.updateSection(section, req.body ?? {});
                    res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                        success: true,
                        message: `${section} settings updated successfully`,
                        data,
                    });
                }
                catch (error) {
                    next(error);
                }
            };
        };
    }
}
exports.SettingsController = SettingsController;
