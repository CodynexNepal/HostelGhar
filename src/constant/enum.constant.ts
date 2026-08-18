// ──────────────────────────────────────────────────────────────────────────────
// FILE: enum.constant.ts
// PURPOSE: Defines application-wide enumerations. Using TypeScript enums
//          instead of raw strings provides:
//          1. Compile-time safety — a typo like 'admn' is caught instantly.
//          2. Autocomplete — IDEs list all valid roles when you type `IROLES.`.
//          3. Single source of truth — adding a new role means editing one enum.
// ──────────────────────────────────────────────────────────────────────────────

// User role enumeration — controls role-based access throughout the app.
// Each member is assigned a lowercase string value because that's what gets
// stored in the database and compared in authorization middleware.
export enum IROLES {
  // Full platform control: manage users, hostels, settings, etc.
  ADMIN = 'admin',

  // A hostel owner who can create/manage their own hostel listings.
  OWNER = 'owner',

  // A regular user who can search, book, and review hostels.
  USER = 'user',

  //

  RESIDENT = 'resident',
}
