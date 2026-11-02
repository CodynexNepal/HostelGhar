// ──────────────────────────────────────────────────────────────────────────────
// FILE: suspend-owner.dto.ts
// PURPOSE: Request validation DTO for suspending a hostel owner account.
// ──────────────────────────────────────────────────────────────────────────────

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendOwnerDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Suspension reason cannot exceed 500 characters' })
  reason?: string;
}
