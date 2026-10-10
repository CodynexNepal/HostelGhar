// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-platform-qr.dto.ts
// PURPOSE: Validation rules for PUT /admin/platform-qrs/:id — replace a
//          platform checkout QR's image and/or label. Same multipart-or-JSON
//          shape as create; every field optional so a label-only edit works.
// ──────────────────────────────────────────────────────────────────────────────

import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PlatformQrMethod } from '../../enum/platform-qr.enum';

export class UpdatePlatformQrDto {
  @IsOptional()
  @IsEnum(PlatformQrMethod, {
    message: 'method must be one of: ESEWA, KHALTI, BANK',
  })
  method?: PlatformQrMethod;

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
