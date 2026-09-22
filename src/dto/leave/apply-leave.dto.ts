// ──────────────────────────────────────────────────────────────────────────────
// FILE: apply-leave.dto.ts
// PURPOSE: Request validation DTO for Resident applying for leave.
// Supports BOTH naming conventions so frontend/backend can never drift:
//   canonical:  leaveTypeId + startDate + endDate + reason
//   legacy UI:  leaveTypeId + fromDate  + toDate   + remarks
// The controller normalizes aliases -> canonical before saving.
// ──────────────────────────────────────────────────────────────────────────────

import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class ApplyLeaveDto {
  @IsUUID('4', { message: 'Leave Type ID must be a valid UUID' })
  leaveTypeId!: string;

  // Canonical names (preferred by docs / new clients).
  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid ISO date string (YYYY-MM-DD)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO date string (YYYY-MM-DD)' })
  endDate?: string;

  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  reason?: string;

  // Legacy aliases sent by the current resident UI. Kept whitelisted so
  // `validateDto` (whitelist + forbidNonWhitelisted) never rejects them
  // with "property X should not exist".
  @IsOptional()
  @IsDateString({}, { message: 'From date must be a valid ISO date string (YYYY-MM-DD)' })
  fromDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'To date must be a valid ISO date string (YYYY-MM-DD)' })
  toDate?: string;

  @IsOptional()
  @IsString({ message: 'Remarks must be a string' })
  remarks?: string;
}
