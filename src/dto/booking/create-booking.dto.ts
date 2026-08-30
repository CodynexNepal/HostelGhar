// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-booking.dto.ts
// PURPOSE: DTO for users with role 'USER' to book a hostel room.
// ──────────────────────────────────────────────────────────────────────────────

import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID('4', { message: 'Hostel ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Hostel ID is required' })
  hostelId!: string;

  @IsDateString({}, { message: 'Check-in date must be a valid ISO format (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Check-in date is required' })
  checkInDate!: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
