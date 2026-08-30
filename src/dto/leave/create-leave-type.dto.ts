// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-leave-type.dto.ts
// PURPOSE: Request validation DTO for Owner creating a Leave Type policy for their Hostel.
// ──────────────────────────────────────────────────────────────────────────────

import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateLeaveTypeDto {
  @IsUUID('4', { message: 'Hostel ID must be a valid UUID' })
  hostelId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Leave type name is required (e.g. Sick Leave, Vacation)' })
  name!: string;

  @IsInt({ message: 'Max days must be an integer' })
  @Min(1, { message: 'Max days must be at least 1' })
  @IsOptional()
  maxDays?: number;

  @IsBoolean({ message: 'requiresParentApproval must be a boolean' })
  @IsOptional()
  requiresParentApproval?: boolean;
}
