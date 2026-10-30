// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.enum.ts
// PURPOSE: Enum defining hostel booking workflow statuses.
// ──────────────────────────────────────────────────────────────────────────────

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'APPROVED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}
