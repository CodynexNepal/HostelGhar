// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.enum.ts
// PURPOSE: Payment methods for Hostel Ghar PLATFORM checkout QRs — the official
//          accounts owners pay TO when buying a subscription (eSewa / Khalti / Bank).
//          Intentionally separate from `payment-qr.enum.ts` (hostel QRs), whose
//          bank value is `BANK_TRANSFER`; the platform contract uses `BANK`.
// ──────────────────────────────────────────────────────────────────────────────

export enum PlatformQrMethod {
  ESEWA = 'ESEWA',
  KHALTI = 'KHALTI',
  BANK = 'BANK',
}
