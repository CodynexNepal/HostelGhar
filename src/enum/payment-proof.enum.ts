// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-proof.enum.ts
// PURPOSE: Enums for resident-submitted payment proofs (screenshot receipts)
//          that hostel owners/admins review before marking a fee paid.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Review lifecycle of an uploaded payment proof.
 * PENDING → APPROVED | REJECTED (owner/admin action).
 */
export enum PaymentProofStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * How the resident paid. Kept separate from `PaymentMethod` (payment-qr) on
 * purpose: the dashboard proof dialog offers ESEWA | KHALTI | BANK | CASH,
 * while QR codes only support wallet/bank-transfer providers.
 */
export enum ProofPaymentMethod {
  ESEWA = 'ESEWA',
  KHALTI = 'KHALTI',
  BANK = 'BANK',
  CASH = 'CASH',
}

/** Action sent by the reviewer: PATCH /payment-proofs/:id/review. */
export enum ProofReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}
