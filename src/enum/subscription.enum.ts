// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.enum.ts
// PURPOSE: Enums for subscription plans, status, and billing cycles.
// ──────────────────────────────────────────────────────────────────────────────

export enum SubscriptionPlan {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
}

/**
 * Admin action on a PENDING subscription request (payment proof review).
 * PATCH/POST `subscriptions/requests/:id/review`.
 */
export enum SubscriptionReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}
