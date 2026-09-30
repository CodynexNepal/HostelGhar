// ──────────────────────────────────────────────────────────────────────────────
// FILE: patch-payment-qr.dto.ts
// PURPOSE: Validation rules for PATCH / partial updates of a payment QR code.
// ──────────────────────────────────────────────────────────────────────────────

import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../enum/payment-qr.enum';

export class PatchPaymentQrDto {
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be one of: ESEWA, KHALTI, BANK_TRANSFER',
  })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString({ message: 'title must be a string' })
  @MaxLength(100, { message: 'title cannot exceed 100 characters' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'subtitle must be a string' })
  @MaxLength(255, { message: 'subtitle cannot exceed 255 characters' })
  subtitle?: string;

  @IsOptional()
  @IsString({ message: 'accountName must be a string' })
  @MaxLength(150, { message: 'accountName cannot exceed 150 characters' })
  accountName?: string;

  @IsOptional()
  @IsString({ message: 'accountIdentifier must be a string' })
  @MaxLength(100, { message: 'accountIdentifier cannot exceed 100 characters' })
  accountIdentifier?: string;

  @IsOptional()
  @IsString({ message: 'bankName must be a string' })
  @MaxLength(150, { message: 'bankName cannot exceed 150 characters' })
  bankName?: string;

  @IsOptional()
  @IsString({ message: 'displayText must be a string' })
  @MaxLength(255, { message: 'displayText cannot exceed 255 characters' })
  displayText?: string;

  @IsOptional()
  @IsString({ message: 'qrCodeUrl must be a string' })
  qrCodeUrl?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsString({ message: 'instructions must be a string' })
  @MaxLength(500, { message: 'instructions cannot exceed 500 characters' })
  instructions?: string;
}
