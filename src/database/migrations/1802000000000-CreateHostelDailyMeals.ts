// ──────────────────────────────────────────────────────────────────────────────
// FILE: 1802000000000-CreateHostelDailyMeals.ts
// PURPOSE: Adds hostel_daily_meals table for Daily Meal Schedule (दैनिक भोजन तालिका).
// ──────────────────────────────────────────────────────────────────────────────

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHostelDailyMeals1802000000000 implements MigrationInterface {
  name = 'CreateHostelDailyMeals1802000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hostel_daily_meals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hostelId" uuid NOT NULL,
        "mealName" character varying(100) NOT NULL,
        "mealNameEn" character varying(100) DEFAULT null,
        "time" character varying(100) NOT NULL,
        "menuDescription" character varying(1000) DEFAULT null,
        "isActive" boolean NOT NULL DEFAULT true,
        "orderIndex" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hostel_daily_meals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hostel_daily_meals_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hostel_daily_meals_hostel_id" ON "hostel_daily_meals" ("hostelId")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hostel_daily_meals_hostel_order" ON "hostel_daily_meals" ("hostelId", "orderIndex")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostel_daily_meals_hostel_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostel_daily_meals_hostel_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hostel_daily_meals"`);
  }
}
