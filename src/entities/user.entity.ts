// ──────────────────────────────────────────────────────────────────────────────
// FILE: user.entity.ts
// PURPOSE: Defines the `User` database table schema using TypeORM decorators.
//          This is the SINGLE source of truth for the user's data shape —
//          TypeORM will auto-generate (synchronize) the PostgreSQL table from
//          this class, eliminating manual SQL migrations during development.
//
// OOP PRINCIPLE: Encapsulation — all column definitions, defaults, and
//                constraints live inside the class, hidden from consumers.
// ──────────────────────────────────────────────────────────────────────────────

// `Entity` marks this class as a TypeORM-managed database table.
// `PrimaryGeneratedColumn` auto-generates the primary key.
// `Column` maps a class property to a table column.
// `CreateDateColumn` / `UpdateDateColumn` are auto-managed timestamp columns.
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Import the roles enum so the `role` column is constrained to valid values
// rather than accepting arbitrary strings — prevents data corruption.
import { IROLES } from '../constant/enum.constant';

// The `@Entity('users')` decorator tells TypeORM to create a table named
// "users" in PostgreSQL. Explicit table naming avoids surprises when TypeORM's
// default naming strategy changes between versions.
@Entity('users')
export class User {
  // ─── Primary Key ──────────────────────────────────────────────────────────

  // UUID v4 is used instead of auto-incrementing integers because:
  // 1. UUIDs are not guessable — prevents enumeration attacks (e.g. /users/1, /users/2).
  // 2. UUIDs are globally unique — safe for distributed systems / DB merges.
  // 3. UUIDs can be generated client-side without a DB round-trip.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ─── User Profile Fields ──────────────────────────────────────────────────

  // First name is required for personalization (greetings, emails, etc.).
  // `nullable: false` means the DB will reject any INSERT missing this field.
  @Column({ type: 'varchar', length: 100, nullable: false })
  firstName!: string;

  // Last name completes the user's identity — kept separate from firstName
  // so we can address users as "Hi Dinesh" without string splitting.
  @Column({ type: 'varchar', length: 100, nullable: false })
  lastName!: string;

  // ─── Authentication Fields ────────────────────────────────────────────────

  // Email is the login identifier. `unique: true` creates a UNIQUE index
  // in PostgreSQL, which simultaneously:
  // 1. Prevents duplicate accounts (data integrity).
  // 2. Speeds up lookups by email (performance) — critical for every login.
  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email!: string;

  // Stores the bcrypt hash of the user's password — NEVER the plaintext.
  // bcrypt hashes are always 60 characters, but we use varchar(255) for
  // forward-compatibility if we switch to argon2 (longer output).
  @Column({ type: 'varchar', length: 255, nullable: false })
  password!: string;

  // ─── Authorization ────────────────────────────────────────────────────────

  // The user's role controls what API endpoints they can access.
  // `enum: IROLES` tells TypeORM to create a PostgreSQL ENUM type, which
  // enforces valid values at the database level — a second line of defense
  // behind application-level validation.
  // Defaults to USER because most sign-ups are regular users; admins and
  // owners are promoted manually or through a separate workflow.
  @Column({ type: 'enum', enum: IROLES, default: IROLES.USER })
  role!: IROLES;

  // ─── Token Management ────────────────────────────────────────────────────

  // Stores a HASHED version of the current refresh token. Why hash it?
  // If the database is compromised, the attacker gets useless hashes
  // instead of valid tokens — same rationale as hashing passwords.
  // `nullable: true` because the field is empty before the user's first login
  // and after logout (when we clear it).
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  refreshToken!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  passwordResetToken!: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  passwordResetExpiresAt!: Date | null;

  // ─── Timestamps ───────────────────────────────────────────────────────────

  // `@CreateDateColumn` is automatically set to `NOW()` on INSERT.
  // Useful for analytics, sorting users by sign-up date, and audit trails.
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // `@UpdateDateColumn` is automatically set to `NOW()` on every UPDATE.
  // Essential for cache invalidation, conflict detection, and debugging
  // "when did this user's data last change?" questions.
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
