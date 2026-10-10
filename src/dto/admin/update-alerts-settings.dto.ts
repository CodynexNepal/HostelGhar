// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-alerts-settings.dto.ts
// PURPOSE: Validation for PUT /admin/settings/alerts.
// ──────────────────────────────────────────────────────────────────────────────

import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateAlertsSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  overdueAlertThreshold?: number;

  @IsOptional()
  @IsBoolean()
  notifyOnSubscriptionProof?: boolean;

  @IsOptional()
  @IsBoolean()
  dailyDigestEmail?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  smsGatewayProvider?: string;
}
