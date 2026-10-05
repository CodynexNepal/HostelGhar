// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-fee-status.dto.ts
// PURPOSE: Validation rules for PATCH /fees/:id/status (owner/admin).
//
// NOTE ON FLEXIBLE CLIENTS: dashboards send the new status under different
// keys (`status` canonical, plus `feeStatus` / `paymentStatus` /
// `payment_status` aliases). All are whitelisted here so `validateDto`
// (whitelist + forbidNonWhitelisted) never 422s with
// "property X should not exist" — the controller normalizes aliases to the
// canonical `status` before calling the service. Same for the optional
// `paidAmount` / `amount` payment aliases.
// ──────────────────────────────────────────────────────────────────────────────

import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FeeStatus } from '../../enum/fee.enum';

export class UpdateFeeStatusDto {
  @IsOptional()
  @IsEnum(FeeStatus, {
    message: 'status must be one of: PENDING, PAID, OVERDUE, PARTIALLY_PAID',
  })
  status?: FeeStatus;

  /** Alias some clients send instead of `status`. */
  @IsOptional()
  @IsEnum(FeeStatus, {
    message: 'feeStatus must be one of: PENDING, PAID, OVERDUE, PARTIALLY_PAID',
  })
  feeStatus?: FeeStatus;

  /** Alias some clients send instead of `status`. */
  @IsOptional()
  @IsEnum(FeeStatus, {
    message: 'paymentStatus must be one of: PENDING, PAID, OVERDUE, PARTIALLY_PAID',
  })
  paymentStatus?: FeeStatus;

  /** snake_case alias some clients send instead of `status`. */
  @IsOptional()
  @IsString({ message: 'payment_status must be a string' })
  payment_status?: string;

  /** Optional payment to apply alongside the status change. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'paidAmount must be a number' })
  @Min(0.01, { message: 'paidAmount must be a positive number' })
  paidAmount?: number;

  /** Alias some clients send instead of `paidAmount`. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number' })
  @Min(0.01, { message: 'amount must be a positive number' })
  amount?: number;
}

