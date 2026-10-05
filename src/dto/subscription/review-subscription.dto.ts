// ──────────────────────────────────────────────────────────────────────────────
// FILE: review-subscription.dto.ts
// PURPOSE: Admin-only DTO for approving or rejecting a PENDING subscription
//          request (the owner's uploaded payment proof).
// ──────────────────────────────────────────────────────────────────────────────

import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SubscriptionReviewAction } from '../../enum/subscription.enum';

export class ReviewSubscriptionDto {
  @IsEnum(SubscriptionReviewAction, {
    message: `action must be one of: ${Object.values(SubscriptionReviewAction).join(', ')}`,
  })
  action!: SubscriptionReviewAction;

  /** Optional reviewer note (e.g. "screenshot amount mismatch" on reject). */
  @IsString()
  @MaxLength(500, { message: 'note cannot exceed 500 characters' })
  @IsOptional()
  note?: string;
}
