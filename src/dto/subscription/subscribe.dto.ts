// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscribe.dto.ts
// PURPOSE: Request validation DTO for requesting a subscription plan change.
//          Paid plans are NOT activated immediately: the owner attaches a
//          payment-proof screenshot and an admin reviews the request.
// ──────────────────────────────────────────────────────────────────────────────

import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BillingCycle, SubscriptionPlan } from '../../enum/subscription.enum';
import { ProofPaymentMethod } from '../../enum/payment-proof.enum';

export class SubscribeDto {
  @IsEnum(SubscriptionPlan, {
    message: `Plan must be one of: ${Object.values(SubscriptionPlan).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Subscription plan is required' })
  plan!: SubscriptionPlan;

  @IsUUID('4', { message: 'Hostel ID must be a valid UUID' })
  @IsOptional()
  hostelId?: string;

  @IsEnum(BillingCycle, {
    message: `Billing cycle must be one of: ${Object.values(BillingCycle).join(', ')}`,
  })
  @IsOptional()
  billingCycle?: BillingCycle;

  /** How the owner paid (eSewa / Khalti / Bank / Cash). */
  @IsEnum(ProofPaymentMethod, {
    message: `paymentMethod must be one of: ${Object.values(ProofPaymentMethod).join(', ')}`,
  })
  @IsOptional()
  paymentMethod?: ProofPaymentMethod;

  /** eSewa/Khalti trace id, cheque no., etc. */
  @IsString()
  @MaxLength(100, { message: 'paymentReference cannot exceed 100 characters' })
  @IsOptional()
  paymentReference?: string;

  /**
   * Payment-proof screenshot URL. Normally the screenshot is uploaded as a
   * file (multer field `proof`); this accepts a client-hosted URL instead.
   */
  @IsString()
  @MaxLength(500, { message: 'proofUrl cannot exceed 500 characters' })
  @IsOptional()
  proofUrl?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
