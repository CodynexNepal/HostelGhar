// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-platform-qr.dto.ts
// PURPOSE: Validation rules for POST /admin/platform-qrs — upload a platform
//          checkout QR. Accepts a multipart file (`qrImage`) OR a JSON body
//          with `qrImageUrl`. The dashboard sends both shapes.
// ──────────────────────────────────────────────────────────────────────────────

import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PlatformQrMethod } from '../../enum/platform-qr.enum';

export class CreatePlatformQrDto {
  @IsEnum(PlatformQrMethod, {
    message: 'method must be one of: ESEWA, KHALTI, BANK',
  })
  @IsNotEmpty({ message: 'method is required' })
  method!: PlatformQrMethod;

  @IsOptional()
  @IsString({ message: 'label must be a string' })
  @MaxLength(255, { message: 'label cannot exceed 255 characters' })
  label?: string;

  @IsOptional()
  @IsString({ message: 'qrImageUrl must be a string' })
  qrImageUrl?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}
