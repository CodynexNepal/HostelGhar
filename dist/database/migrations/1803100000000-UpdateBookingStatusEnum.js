"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: 1803100000000-UpdateBookingStatusEnum.ts
// PURPOSE: Ensures 'APPROVED' and 'CONFIRMED' are present in bookings_status_enum.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBookingStatusEnum1803100000000 = void 0;
class UpdateBookingStatusEnum1803100000000 {
    constructor() {
        this.name = 'UpdateBookingStatusEnum1803100000000';
    }
    async up(queryRunner) {
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
    async down(_queryRunner) {
        // In PostgreSQL, enum values cannot be easily dropped without rebuilding the type.
    }
}
exports.UpdateBookingStatusEnum1803100000000 = UpdateBookingStatusEnum1803100000000;
