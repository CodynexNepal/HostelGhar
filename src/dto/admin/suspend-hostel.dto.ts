// ──────────────────────────────────────────────────────────────────────────────
// FILE: suspend-hostel.dto.ts
// PURPOSE: Optional suspend reason for admin hostel suspend/reactivate.
// ──────────────────────────────────────────────────────────────────────────────

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendHostelDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Suspend reason must not exceed 500 characters' })
  reason?: string;
}
