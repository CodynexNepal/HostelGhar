// ──────────────────────────────────────────────────────────────────────────────
// FILE: leave.enum.ts
// PURPOSE: Central enum defining leave request status workflow.
// ──────────────────────────────────────────────────────────────────────────────

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
