// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-staff.dto.ts
// PURPOSE: Partial validation for updating a hostel staff member.
// ──────────────────────────────────────────────────────────────────────────────

import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { StaffRole, StaffShift, StaffStatus } from '../../enum/staff.enum';

const normalizeEnumValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  let upper = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  if (upper === 'SECURITYGUARD') upper = 'SECURITY_GUARD';
  if (upper === 'SECURITY') upper = 'GUARD';
  if (upper === 'FULLDAY' || upper === 'FULL-DAY' || upper === 'FULL DAY') upper = 'FULL_DAY';
  if (upper === 'ONLEAVE' || upper === 'ON-LEAVE' || upper === 'ON LEAVE') upper = 'ON_LEAVE';
  return upper;
};

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\- ]{7,20}$/, { message: 'Phone number looks invalid' })
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeEnumValue(value))
  @IsEnum(StaffRole, { message: 'Role must be a valid staff role' })
  role?: StaffRole;

  @IsOptional()
  @Transform(({ value }) => normalizeEnumValue(value))
  @IsEnum(StaffShift, { message: 'Shift must be a valid shift' })
  shift?: StaffShift;

  @IsOptional()
  @Transform(({ value }) => normalizeEnumValue(value))
  @IsEnum(StaffStatus, { message: 'Status must be a valid status' })
  status?: StaffStatus;

  @IsOptional()
  @IsEmail({}, { message: 'Email must be valid' })
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Monthly salary must be a number' })
  @IsPositive({ message: 'Monthly salary must be positive' })
  monthlySalary?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContact?: string | null;
}
