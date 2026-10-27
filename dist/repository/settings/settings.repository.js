"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: settings.repository.ts
// PURPOSE: Data access layer for platform_settings (one row per section).
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsRepository = void 0;
const database_source_1 = require("../../database/database-source");
const platform_setting_entity_1 = require("../../entities/settings/platform-setting.entity");
class SettingsRepository {
    get repo() {
        return database_source_1.AppDataSource.getRepository(platform_setting_entity_1.PlatformSetting);
    }
    async findBySection(section) {
        try {
            return await this.repo.findOne({ where: { section } });
        }
        catch {
            return null;
        }
    }
    async findAll() {
        try {
            return await this.repo.find();
        }
        catch {
            return [];
        }
    }
    async upsertSection(section, value) {
        const existing = await this.findBySection(section);
        if (existing) {
            existing.value = value;
            return await this.repo.save(existing);
        }
        return await this.repo.save(this.repo.create({ section, value }));
    }
}
exports.SettingsRepository = SettingsRepository;
