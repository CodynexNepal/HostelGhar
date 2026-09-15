// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-resident.dto.ts
// PURPOSE: Request validation DTO for Owner creating/assigning a resident.
// ──────────────────────────────────────────────────────────────────────────────

import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResidentDto {
  @IsString()
  @IsNotEmpty({ message: 'Resident name is required' })
  @MaxLength(200)
  name!: string;

  @IsEmail({}, { message: 'A valid email is required' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Temporary password must be at least 6 characters' })
  @IsOptional()
  password?: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone is required' })
  @MaxLength(20)
  phone!: string;

  @IsUUID('4', { message: 'Hostel ID must be a valid UUID' })
  @IsOptional()
  hostelId!: string;

  // Flat selector from the frontend (alias of Room.floor — no flat column exists).
  // Optional: used to scope room lookup + echoed back in the create response.
  @IsInt({ message: 'Flat must be an integer' })
  @Min(0, { message: 'Flat cannot be negative' })
  @IsOptional()
  @Type(() => Number)
  flat?: number;

  @IsString()
  @IsNotEmpty({ message: 'Room number is required' })
  roomNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'Bed number is required' })
  bedNumber!: string;

  @IsNumber({}, { message: 'Monthly rent must be a number' })
  @IsOptional()
  @Type(() => Number)
  monthlyRent?: number;
}
