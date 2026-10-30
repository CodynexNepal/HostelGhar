// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-booking.dto.ts
// PURPOSE: DTO and request interface for users with role 'USER' to book a hostel room.
// ──────────────────────────────────────────────────────────────────────────────

import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export interface CreateBookingRequest {
  hostelId: string;
  checkInDate: string; // ISO date format YYYY-MM-DD
  remarks?: string;
  studentName?: string;
  phone?: string;
  email?: string;
}

export class CreateBookingDto implements CreateBookingRequest {
  @IsUUID('4', { message: 'Hostel ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Hostel ID is required' })
  hostelId!: string;

  @IsDateString({}, { message: 'Check-in date must be a valid ISO format (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Check-in date is required' })
  checkInDate!: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(150, { message: 'Student name must be at most 150 characters' })
  @IsOptional()
  studentName?: string;

  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(20, { message: 'Phone number must be at most 20 characters' })
  @IsOptional()
  phone?: string;

  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsEmail({}, { message: 'Email must be valid' })
  @MaxLength(255, { message: 'Email must be at most 255 characters' })
  @IsOptional()
  email?: string;
}
