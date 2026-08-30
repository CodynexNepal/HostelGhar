// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-hostel.dto.ts
// PURPOSE: Request validation DTO for Admin creating a Hostel.
// ──────────────────────────────────────────────────────────────────────────────

import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { HostelType } from '../../enum/hostel.enum';

export class CreateHostelDto {
  @IsString()
  @IsNotEmpty({ message: 'Hostel name is required' })
  name!: string;

  @IsEnum(HostelType, { message: 'Type must be either BOYS or GIRLS' })
  type!: HostelType;

  @IsUUID('4', { message: 'Owner ID must be a valid UUID v4' })
  @IsOptional()
  ownerId?: string;
}
