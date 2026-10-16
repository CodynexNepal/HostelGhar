// ──────────────────────────────────────────────────────────────────────────────
// FILE: staff.enum.ts
// PURPOSE: Staff role / shift / status enumerations for hostel staff management.
// ──────────────────────────────────────────────────────────────────────────────

export enum StaffRole {
  WARDEN = 'WARDEN',
  MANAGER = 'MANAGER',
  COOK = 'COOK',
  CLEANER = 'CLEANER',
  GUARD = 'GUARD',
  SECURITY_GUARD = 'SECURITY_GUARD',
  ACCOUNTANT = 'ACCOUNTANT',
  RECEPTIONIST = 'RECEPTIONIST',
  MAINTENANCE = 'MAINTENANCE',
  DRIVER = 'DRIVER',
  OTHER = 'OTHER',
}

export enum StaffShift {
  DAY = 'DAY',
  NIGHT = 'NIGHT',
  MORNING = 'MORNING',
  EVENING = 'EVENING',
  FULL_DAY = 'FULL_DAY',
}

export enum StaffStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  TERMINATED = 'TERMINATED',
}
