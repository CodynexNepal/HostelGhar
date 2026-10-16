// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-staff.dto.ts
// PURPOSE: Validation for Owner/Admin creating a staff member of a hostel.
// Accepts JSON or multipart/form-data (photo file under `photo` field).
// ──────────────────────────────────────────────────────────────────────────────

import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { StaffRole, StaffShift, StaffStatus } from '../../enum/staff.enum';

const normalizeEnumValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  let upper = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  // Alias: SECURITY GUARD commonly typed as GUARD
  if (upper === 'SECURITYGUARD') upper = 'SECURITY_GUARD';
  if (upper === 'SECURITY') upper = 'GUARD';
  if (upper === 'FULLDAY' || upper === 'FULL-DAY' || upper === 'FULL DAY') upper = 'FULL_DAY';
  if (upper === 'ONLEAVE' || upper === 'ON-LEAVE' || upper === 'ON LEAVE') upper = 'ON_LEAVE';
  return upper;
};

export class CreateStaffDto {
  // Optional here so callers may pass ?hostelId= / X-Hostel-Id header instead
  // of a body field (multipart forms). Controller enforces presence.
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsUUID('4', { message: 'hostelId must be a valid UUID' })
  hostelId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(120, { message: 'Full name must be at most 120 characters' })
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^[0-9+\- ]{7,20}$/, { message: 'Phone number looks invalid' })
  @MaxLength(20)
  phone!: string;

  @Transform(({ value }) => normalizeEnumValue(value))
  @IsEnum(StaffRole, {
    message:
      'Role must be one of: WARDEN, MANAGER, COOK, CLEANER, GUARD, ACCOUNTANT, RECEPTIONIST, MAINTENANCE, DRIVER, OTHER',
  })
  role!: StaffRole;

  @Transform(({ value }) => normalizeEnumValue(value))
  @IsEnum(StaffShift, { message: 'Shift must be one of: DAY, NIGHT, MORNING, EVENING, FULL_DAY' })
  @IsOptional()
  shift?: StaffShift;

  @Transform(({ value }) => normalizeEnumValue(value))
  @IsEnum(StaffStatus, { message: 'Status must be one of: ACTIVE, INACTIVE, ON_LEAVE, TERMINATED' })
  @IsOptional()
  status?: StaffStatus;

  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsEmail({}, { message: 'Email must be valid' })
  @MaxLength(255)
  @IsOptional()
  email?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Monthly salary must be a number' })
  @IsPositive({ message: 'Monthly salary must be positive' })
  @IsOptional()
  monthlySalary?: number;

  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @Matches(/^[0-9+\- ]{7,20}$/, { message: 'Emergency contact looks invalid' })
  @MaxLength(20)
  @IsOptional()
  emergencyContact?: string;
}
