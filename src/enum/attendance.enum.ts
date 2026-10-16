// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.enum.ts
// PURPOSE: Resident attendance status enumerations (daily check-in records).
// ──────────────────────────────────────────────────────────────────────────────

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  HALF_DAY = 'HALF_DAY',
  ON_LEAVE = 'ON_LEAVE',
}
