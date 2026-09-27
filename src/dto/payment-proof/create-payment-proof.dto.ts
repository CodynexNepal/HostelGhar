// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-payment-proof.dto.ts
// PURPOSE: Validation rules for POST /fees/:feeId/payment-proofs.
//
// NOTE ON FLEXIBLE CLIENTS: the dashboard posts EITHER multipart/form-data
// (screenshot/receipt file + text parts) OR plain JSON (imageUrl). Text parts
// arrive as strings, so `@Type(() => Number)` coerces `amount`. Aliases some
// clients send (`transactionId`) are accepted here and normalized in the
// service — anything NOT declared here is rejected by `forbidNonWhitelisted`.
// ──────────────────────────────────────────────────────────────────────────────

import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProofPaymentMethod } from '../../enum/payment-proof.enum';

export class CreatePaymentProofDto {
  /**
   * Paid amount. Optional: when omitted (or 0) the service falls back to the
   * fee's outstanding balance, so a client that only knows the bill still
   * uploads successfully.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number' })
  @Min(0, { message: 'amount must be zero or greater' })
  amount?: number;

  @IsEnum(ProofPaymentMethod, {
    message: 'method must be one of: ESEWA, KHALTI, BANK, CASH',
  })
  method!: ProofPaymentMethod;

  /** Transaction / reference ID from the wallet or bank receipt. */
  @IsOptional()
  @IsString({ message: 'transactionRef must be a string' })
  @MaxLength(100, { message: 'transactionRef cannot exceed 100 characters' })
  transactionRef?: string;

  /** Alias some clients send instead of `transactionRef`. */
  @IsOptional()
  @IsString({ message: 'transactionId must be a string' })
  @MaxLength(100, { message: 'transactionId cannot exceed 100 characters' })
  transactionId?: string;

  @IsOptional()
  @IsString({ message: 'remarks must be a string' })
  @MaxLength(500, { message: 'remarks cannot exceed 500 characters' })
  remarks?: string;

  /**
   * Alternative to uploading a file: an image URL (or base64 data URL).
   * The hostel is always derived from the fee bill, never trusted from here —
   * declared only so the dashboard's optional `hostelId` part passes whitelist
   * validation instead of failing with 422.
   */
  @IsOptional()
  @IsString({ message: 'imageUrl must be a string' })
  imageUrl?: string;

  @IsOptional()
  @IsString({ message: 'hostelId must be a string' })
  @MaxLength(64, { message: 'hostelId is not a valid identifier' })
  hostelId?: string;
}
