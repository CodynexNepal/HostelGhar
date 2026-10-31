// ──────────────────────────────────────────────────────────────────────────────
// FILE: mark-attendance.dto.ts
// PURPOSE: Validation for a Resident self check-in / check-out.
//          Residents may only mark themselves PRESENT or LATE — absence
//          marking is an owner/admin action, not a self-service one.
//          Allows optional hostelId and device GPS coordinates (latitude/longitude)
//          for geofencing verification against the hostel's location.
// ──────────────────────────────────────────────────────────────────────────────

import { Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
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
  @IsString()
  @IsOptional()
  hostelId?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'latitude must be a valid number' })
  @Min(-90, { message: 'latitude must be >= -90' })
  @Max(90, { message: 'latitude must be <= 90' })
  @IsOptional()
  latitude?: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'longitude must be a valid number' })
  @Min(-180, { message: 'longitude must be >= -180' })
  @Max(180, { message: 'longitude must be <= 180' })
  @IsOptional()
  longitude?: number;

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

export class CheckOutAttendanceDto {
  @IsString()
  @IsOptional()
  hostelId?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'latitude must be a valid number' })
  @Min(-90, { message: 'latitude must be >= -90' })
  @Max(90, { message: 'latitude must be <= 90' })
  @IsOptional()
  latitude?: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'longitude must be a valid number' })
  @Min(-180, { message: 'longitude must be >= -180' })
  @Max(180, { message: 'longitude must be <= 180' })
  @IsOptional()
  longitude?: number;

  @IsString()
  @MaxLength(500, { message: 'note must be at most 500 characters' })
  @IsOptional()
  note?: string;
}
