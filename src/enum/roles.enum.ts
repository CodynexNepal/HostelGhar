// ──────────────────────────────────────────────────────────────────────────────
// FILE: roles.enum.ts
// PURPOSE: Centralized application roles enumeration.
// ──────────────────────────────────────────────────────────────────────────────

export enum IROLES {
  ADMIN = 'admin',
  OWNER = 'owner',
  USER = 'user',
  RESIDENT = 'resident',
}

export type UserRole = `${IROLES}`;
