// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.enum.ts
// PURPOSE: Enum defining hostel booking workflow statuses.
// ──────────────────────────────────────────────────────────────────────────────

export enum BookingStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}
