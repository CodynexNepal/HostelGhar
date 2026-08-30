// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-resident.dto.ts
// PURPOSE: Request validation DTO for Owner creating/assigning a resident.
// ──────────────────────────────────────────────────────────────────────────────

import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateResidentDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName!: string;

  @IsEmail({}, { message: 'A valid email is required' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Temporary password must be at least 6 characters' })
  @IsOptional()
  password?: string;

  @IsUUID('4', { message: 'Hostel ID must be a valid UUID' })
  hostelId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Room number is required' })
  roomNumber!: string;
}
