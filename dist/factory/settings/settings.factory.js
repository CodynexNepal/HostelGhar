"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsFactory = void 0;
const settings_controller_1 = require("../../controller/settings/settings.controller");
const settings_repository_1 = require("../../repository/settings/settings.repository");
const settings_service_1 = require("../../services/settings/settings.service");
class SettingsFactory {
    constructor() { }
    static create() {
        const repository = new settings_repository_1.SettingsRepository();
        const service = new settings_service_1.SettingsService(repository);
        return new settings_controller_1.SettingsController(service);
    }
}
exports.SettingsFactory = SettingsFactory;
