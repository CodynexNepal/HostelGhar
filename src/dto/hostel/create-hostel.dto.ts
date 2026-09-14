// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-hostel.dto.ts
// PURPOSE: Request validation DTO for Admin creating a Hostel.
// ──────────────────────────────────────────────────────────────────────────────

import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { HostelType } from '../../enum/hostel.enum';

// Multer sends multipart fields as strings; an untouched optional input often
// arrives as "" — convert it to undefined so @IsOptional() skips it instead
// of failing e.g. @IsEmail("").
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  value === '' || (typeof value === 'string' && value.trim() === '') ? undefined : value;

export class CreateHostelDto {
  @IsString()
  @IsNotEmpty({ message: 'Hostel name is required' })
  @MaxLength(120, { message: 'Hostel name must not exceed 120 characters' })
  name!: string;

  // Accept "GIRLS"/"girls"/"Girls" — multer sends multipart fields as strings,
  // so normalise case before the enum check. DB still stores BOYS/GIRLS.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsEnum(HostelType, { message: 'Type must be either BOYS or GIRLS' })
  type!: HostelType;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(20)
  // Loose phone check — accepts local numbers like "9867567898".
  // Use @IsPhoneNumber('NP') here only if ALL hostels are Nepali numbers.
  phone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail({}, { message: 'Please provide a valid hostel email address' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID('4', { message: 'Owner ID must be a valid UUID v4' })
  ownerId?: string;

  // NOTE: `logo` / `image` are FILE fields, not body strings. Multer extracts
  // them into `req.files` (→ Cloudinary → logoUrl) and they must NOT be
  // declared here. Some clients also send a stray text part with the same
  // name — `stripFileFields` (upload.middleware) removes those from req.body
  // before validation so `forbidNonWhitelisted` never sees them.
}
