// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-invoice.dto.ts
// PURPOSE: Validation for Owner/Admin manually creating one resident invoice.
// Accepts EITHER residentId OR residentName (+hotel scoping), flexible billing
// month shapes ("2026-09", "September 2026", 9), and amount/dueDate/status
// aliases so the dashboard "Create invoice" form never 422s on key names.
// ──────────────────────────────────────────────────────────────────────────────

import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { FeeStatus } from '../../enum/fee.enum';

/** Invoice send mode: DRAFT saves silently, SEND_NOW also emails the resident. */
export enum InvoiceSendMode {
  DRAFT = 'DRAFT',
  SEND_NOW = 'SEND_NOW',
}

export class CreateInvoiceDto {
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsUUID('4', { message: 'hostelId must be a valid UUID' })
  hostelId?: string;

  /** Canonical resident reference. */
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsUUID('4', { message: 'residentId must be a valid UUID' })
  residentId?: string;

  /** Dashboard form sends the resident's display name ("Sita Karki"). */
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MinLength(2, { message: 'Resident name must be at least 2 characters' })
  @MaxLength(200)
  residentName?: string;

  /** snake_case alias for residentName. */
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(200)
  resident_name?: string;

  /** Optional email fallback when the resident row has no email on file. */
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsEmail({}, { message: 'residentEmail must be valid' })
  @MaxLength(255)
  @IsOptional()
  residentEmail?: string;

  /**
   * Billing month — flexible input, normalized in service:
   *  - 1..12 (uses billingYear, defaults to current year)
   *  - "2026-09" / "09/2026" / "September 2026" / "Sept 2026"
   */
  @IsNotEmpty({ message: 'Billing month is required' })
  billingMonth!: number | string;

  /** Billing year override (defaults to current year / parsed year). */
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @Type(() => Number)
  @IsInt({ message: 'billingYear must be an integer year' })
  @Min(2000)
  @Max(2100)
  billingYear?: number;

  /** Canonical amount (NPR). */
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number' })
  @IsPositive({ message: 'amount must be positive' })
  amount?: number;

  /** Alias some forms send instead of `amount`. */
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @Type(() => Number)
  @IsNumber({}, { message: 'total must be a number' })
  @IsPositive({ message: 'total must be positive' })
  @IsOptional()
  total?: number;

  /** Alias some forms send instead of `amount`. */
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @Type(() => Number)
  @IsNumber({}, { message: 'totalPayable must be a number' })
  @IsPositive({ message: 'totalPayable must be positive' })
  @IsOptional()
  totalPayable?: number;

  /** Canonical due date (ISO YYYY-MM-DD; mm/dd/yyyy also accepted). */
  @IsNotEmpty({ message: 'Due date is required' })
  @IsString()
  dueDate!: string;

  /** snake_case alias for dueDate. */
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @IsOptional()
  due_date?: string;

  /**
   * Canonical status. DRAFT is stored as PENDING (silent, no email);
   * any other value is stored as-is.
   */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  /** Explicit send mode — wins over `status` when both are present. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  sendMode?: string;

  /** Alias: dashboard "Send now" toggle posts sendNow: true. */
  @IsOptional()
  sendNow?: boolean | string;

  /** Unused today — whitelisted so strict mode never 422s dashboard extras. */
  @IsOptional()
  @IsEnum(FeeStatus, { message: 'feeStatus must be a valid fee status' })
  feeStatus?: FeeStatus;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  payment_status?: string;
}
