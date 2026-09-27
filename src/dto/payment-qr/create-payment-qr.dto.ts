// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-payment-qr.dto.ts
// PURPOSE: Validation rules for creating a new hostel payment QR code.
// ──────────────────────────────────────────────────────────────────────────────

import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../enum/payment-qr.enum';

export class CreatePaymentQrDto {
  @IsOptional()
  @IsUUID('4', { message: 'hostelId must be a valid UUID' })
  hostelId?: string;

  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be one of: ESEWA, KHALTI, BANK_TRANSFER',
  })
  @IsNotEmpty({ message: 'paymentMethod is required' })
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString({ message: 'title must be a string' })
  @MaxLength(100, { message: 'title cannot exceed 100 characters' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'subtitle must be a string' })
  @MaxLength(255, { message: 'subtitle cannot exceed 255 characters' })
  subtitle?: string;

  @IsString({ message: 'accountName must be a string' })
  @IsNotEmpty({ message: 'accountName is required (e.g., Sunrise Hostel)' })
  @MaxLength(150, { message: 'accountName cannot exceed 150 characters' })
  accountName!: string;

  @IsString({ message: 'accountIdentifier must be a string' })
  @IsNotEmpty({
    message: 'accountIdentifier is required (e.g., eSewa/Khalti phone number or bank account number)',
  })
  @MaxLength(100, { message: 'accountIdentifier cannot exceed 100 characters' })
  accountIdentifier!: string;

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
