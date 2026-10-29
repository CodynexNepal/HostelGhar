// ──────────────────────────────────────────────────────────────────────────────
// FILE: 1802100000000-AddDayOfWeekToHostelDailyMeals.ts
// PURPOSE: Adds dayOfWeek column and index to hostel_daily_meals table.
// ──────────────────────────────────────────────────────────────────────────────

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDayOfWeekToHostelDailyMeals1802100000000 implements MigrationInterface {
  name = 'AddDayOfWeekToHostelDailyMeals1802100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hostel_daily_meals" ADD COLUMN IF NOT EXISTS "dayOfWeek" character varying(20) NOT NULL DEFAULT 'ALL'`,
    );

    await queryRunner.query(
      `UPDATE "hostel_daily_meals" SET "dayOfWeek" = 'ALL' WHERE "dayOfWeek" IS NULL OR "dayOfWeek" = ''`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hostel_daily_meals_hostel_day_order" ON "hostel_daily_meals" ("hostelId", "dayOfWeek", "orderIndex")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostel_daily_meals_hostel_day_order"`);
    await queryRunner.query(`ALTER TABLE "hostel_daily_meals" DROP COLUMN IF EXISTS "dayOfWeek"`);
  }
}
