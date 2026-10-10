// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-access-settings.dto.ts
// PURPOSE: Validation for PUT /admin/settings/access.
// ──────────────────────────────────────────────────────────────────────────────

import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateAccessSettingsDto {
  @IsOptional()
  @IsBoolean()
  allowPublicHostelSignup?: boolean;

  @IsOptional()
  @IsBoolean()
  requireHostelApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  allowResidentSelfInvite?: boolean;

  @IsOptional()
  @IsBoolean()
  requireAdmin2FA?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  sessionLifetimeDays?: number;
}
