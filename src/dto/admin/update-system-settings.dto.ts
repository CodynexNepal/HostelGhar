// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-system-settings.dto.ts
// PURPOSE: Validation for PUT /admin/settings/system.
// ──────────────────────────────────────────────────────────────────────────────

import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSystemSettingsDto {
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  maintenanceMessage?: string;
}
