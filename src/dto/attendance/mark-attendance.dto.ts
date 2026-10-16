// ──────────────────────────────────────────────────────────────────────────────
// FILE: mark-attendance.dto.ts
// PURPOSE: Validation for a Resident self check-in for the current day.
//          Residents may only mark themselves PRESENT or LATE — absence
//          marking is an owner/admin action, not a self-service one.
// ──────────────────────────────────────────────────────────────────────────────

import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AttendanceStatus } from '../../enum/attendance.enum';

const normalizeEnumValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.toUpperCase().replace(/[\s-]+/g, '_');
};

// Self check-in statuses a resident may pick. ABSENT / HALF_DAY / ON_LEAVE
// are owner-controlled and rejected here by the @IsIn whitelist.
const RESIDENT_CHECK_IN_STATUSES = [AttendanceStatus.PRESENT, AttendanceStatus.LATE] as const;

export class MarkAttendanceDto {
  @Transform(({ value }) => normalizeEnumValue(value))
  @IsIn(RESIDENT_CHECK_IN_STATUSES, {
    message: 'status must be PRESENT or LATE for self check-in',
  })
  @IsOptional()
  status?: AttendanceStatus;

  @IsString()
  @MaxLength(500, { message: 'note must be at most 500 characters' })
  @IsOptional()
  note?: string;
}
