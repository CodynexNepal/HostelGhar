// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-resident.dto.ts
// PURPOSE: Request validation DTO for Owner updating resident details.
// ──────────────────────────────────────────────────────────────────────────────

import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateResidentDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @IsEmail({}, { message: 'A valid email is required' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsUUID('4', { message: 'Hostel ID must be a valid UUID' })
  @IsOptional()
  hostelId?: string;

  @IsInt({ message: 'Flat must be an integer' })
  @Min(0, { message: 'Flat cannot be negative' })
  @IsOptional()
  @Type(() => Number)
  flat?: number;

  @IsString()
  @IsOptional()
  roomNumber?: string;

  @IsString()
  @IsOptional()
  bedNumber?: string;

  @IsNumber({}, { message: 'Monthly rent must be a number' })
  @IsOptional()
  @Type(() => Number)
  monthlyRent?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
