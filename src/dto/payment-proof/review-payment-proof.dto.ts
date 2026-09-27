// ──────────────────────────────────────────────────────────────────────────────
// FILE: review-payment-proof.dto.ts
// PURPOSE: Validation rules for PATCH /payment-proofs/:id/review (owner/admin).
// ──────────────────────────────────────────────────────────────────────────────

import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProofPaymentMethod, ProofReviewAction } from '../../enum/payment-proof.enum';

export class ReviewPaymentProofDto {
  @IsEnum(ProofReviewAction, { message: 'action must be one of: APPROVE, REJECT' })
  action!: ProofReviewAction;

  @IsOptional()
  @IsString({ message: 'note must be a string' })
  @MaxLength(500, { message: 'note cannot exceed 500 characters' })
  note?: string;

  /** Optional amount override applied when approving (defaults to submitted). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number' })
  @Min(0, { message: 'amount must be zero or greater' })
  amount?: number;

  /** Optional payment method override applied when approving. */
  @IsOptional()
  @IsEnum(ProofPaymentMethod, {
    message: 'method must be one of: ESEWA, KHALTI, BANK, CASH',
  })
  method?: ProofPaymentMethod;
}
