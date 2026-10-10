// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-setting.entity.ts
// PURPOSE: Single-row-per-section persistent store for platform admin settings.
//          Sections: general | billing | access | alerts | system.
// ──────────────────────────────────────────────────────────────────────────────

import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type PlatformSettingSection = 'general' | 'billing' | 'access' | 'alerts' | 'system';

@Entity('platform_settings')
export class PlatformSetting {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  section!: PlatformSettingSection;

  @Column({ type: 'jsonb', nullable: false })
  value!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
