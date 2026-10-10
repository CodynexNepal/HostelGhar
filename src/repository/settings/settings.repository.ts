// ──────────────────────────────────────────────────────────────────────────────
// FILE: settings.repository.ts
// PURPOSE: Data access layer for platform_settings (one row per section).
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import {
  PlatformSetting,
  PlatformSettingSection,
} from '../../entities/settings/platform-setting.entity';

export class SettingsRepository {
  private get repo(): Repository<PlatformSetting> {
    return AppDataSource.getRepository(PlatformSetting);
  }

  public async findBySection(section: PlatformSettingSection): Promise<PlatformSetting | null> {
    try {
      return await this.repo.findOne({ where: { section } });
    } catch {
      return null;
    }
  }

  public async findAll(): Promise<PlatformSetting[]> {
    try {
      return await this.repo.find();
    } catch {
      return [];
    }
  }

  public async upsertSection(
    section: PlatformSettingSection,
    value: Record<string, unknown>,
  ): Promise<PlatformSetting> {
    const existing = await this.findBySection(section);
    if (existing) {
      existing.value = value;
      return await this.repo.save(existing);
    }
    return await this.repo.save(this.repo.create({ section, value }));
  }
}
