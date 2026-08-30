// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee.enum.ts
// PURPOSE: Enums defining fee cycle, types, and payment statuses.
// ──────────────────────────────────────────────────────────────────────────────

export enum FeeStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
}

export enum FeeType {
  MONTHLY_HOSTEL_FEE = 'MONTHLY_HOSTEL_FEE',
  MAINTENANCE = 'MAINTENANCE',
  ADMISSION_FEE = 'ADMISSION_FEE',
  FINE = 'FINE',
}
