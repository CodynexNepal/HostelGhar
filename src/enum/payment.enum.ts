// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.enum.ts
// PURPOSE: Enums defining payment methods and transaction lifecycle statuses.
// ──────────────────────────────────────────────────────────────────────────────

export enum PaymentMethod {
  CASH = 'CASH',
  ESEWA = 'ESEWA',
  KHALTI = 'KHALTI',
  BANK_TRANSFER = 'BANK_TRANSFER',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}
