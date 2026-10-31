// ──────────────────────────────────────────────────────────────────────────────
// FILE: record-payment.dto.ts
// PURPOSE: Validation DTO for recording partial or full payments against invoices.
// ──────────────────────────────────────────────────────────────────────────────

import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../enum/payment.enum';

export class RecordPaymentDto {
  @IsNotEmpty({ message: 'Amount is required' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amount must be a valid monetary value' })
  @IsPositive({ message: 'Amount must be greater than zero' })
  amount!: number;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: 'Payment method must be one of: CASH, ESEWA, KHALTI, BANK_TRANSFER, OTHER',
  })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
