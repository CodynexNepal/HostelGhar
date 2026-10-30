// ──────────────────────────────────────────────────────────────────────────────
// FILE: 1802200000000-AddStudentContactFieldsToBookings.ts
// PURPOSE: Adds studentName, phone, and email fields to bookings table.
// ──────────────────────────────────────────────────────────────────────────────

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentContactFieldsToBookings1802200000000 implements MigrationInterface {
  name = 'AddStudentContactFieldsToBookings1802200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "studentName" character varying(150) DEFAULT null`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "phone" character varying(20) DEFAULT null`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "email" character varying(255) DEFAULT null`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "email"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "phone"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "studentName"`);
  }
}
