// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-general-settings.dto.ts
// PURPOSE: Validation for PUT /admin/settings/general.
// ──────────────────────────────────────────────────────────────────────────────

import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  platformName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  timezone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid support email address' })
  @MaxLength(255)
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  supportPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  officeAddress?: string;
}
