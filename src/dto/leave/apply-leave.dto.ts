// ──────────────────────────────────────────────────────────────────────────────
// FILE: apply-leave.dto.ts
// PURPOSE: Request validation DTO for Resident applying for leave.
// ──────────────────────────────────────────────────────────────────────────────

import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ApplyLeaveDto {
  @IsUUID('4', { message: 'Leave Type ID must be a valid UUID' })
  leaveTypeId!: string;

  @IsDateString({}, { message: 'Start date must be a valid ISO date string (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Start date is required' })
  startDate!: string;

  @IsDateString({}, { message: 'End date must be a valid ISO date string (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'End date is required' })
  endDate!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
