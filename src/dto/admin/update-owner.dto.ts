// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-owner.dto.ts
// PURPOSE: Request validation DTO for updating an existing hostel owner.
// ──────────────────────────────────────────────────────────────────────────────

import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SubscriptionPlan } from '../../enum/subscription.enum';

export class UpdateOwnerDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Owner name must be at least 2 characters' })
  @MaxLength(100, { message: 'Owner name cannot exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'A valid email is required' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone number cannot exceed 20 characters' })
  phone?: string;

  @IsOptional()
  @IsEnum(SubscriptionPlan, { message: 'Invalid subscription plan' })
  plan?: SubscriptionPlan;
}
