// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-billing-settings.dto.ts
// PURPOSE: Validation for PUT /admin/settings/billing.
// ──────────────────────────────────────────────────────────────────────────────

import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateBillingSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  standardPlanPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  enterprisePlanPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  freeTierResidentCap?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;

  @IsOptional()
  @IsBoolean()
  allowQrCheckout?: boolean;

  @IsOptional()
  @IsBoolean()
  autoRemindRenewals?: boolean;
}
