// ──────────────────────────────────────────────────────────────────────────────
// FILE: 1803100000000-UpdateBookingStatusEnum.ts
// PURPOSE: Ensures 'APPROVED' and 'CONFIRMED' are present in bookings_status_enum.
// ──────────────────────────────────────────────────────────────────────────────

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateBookingStatusEnum1803100000000 implements MigrationInterface {
  name = 'UpdateBookingStatusEnum1803100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bookings_status_enum') THEN
          ALTER TYPE "bookings_status_enum" ADD VALUE IF NOT EXISTS 'APPROVED';
          ALTER TYPE "bookings_status_enum" ADD VALUE IF NOT EXISTS 'CONFIRMED';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // In PostgreSQL, enum values cannot be easily dropped without rebuilding the type.
  }
}
