// ──────────────────────────────────────────────────────────────────────────────
// FILE: 1801000000000-CreateHostelMealsAndLocationFields.ts
// PURPOSE: Adds hostel geographic location sharing fields and weekly meals table.
// ──────────────────────────────────────────────────────────────────────────────

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHostelMealsAndLocationFields1801000000000 implements MigrationInterface {
  name = 'CreateHostelMealsAndLocationFields1801000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add location fields to hostels table
    await queryRunner.query(
      `ALTER TABLE "hostels" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7) DEFAULT null`,
    );
    await queryRunner.query(
      `ALTER TABLE "hostels" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7) DEFAULT null`,
    );
    await queryRunner.query(
      `ALTER TABLE "hostels" ADD COLUMN IF NOT EXISTS "isLocationShared" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "hostels" ADD COLUMN IF NOT EXISTS "locationUpdatedAt" TIMESTAMPTZ DEFAULT null`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CK_hostels_latitude_range'
        ) THEN
          ALTER TABLE "hostels"
            ADD CONSTRAINT "CK_hostels_latitude_range"
            CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90));
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CK_hostels_longitude_range'
        ) THEN
          ALTER TABLE "hostels"
            ADD CONSTRAINT "CK_hostels_longitude_range"
            CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180));
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hostels_is_location_shared" ON "hostels" ("isLocationShared")`,
    );

    // 2. Create DayOfWeek enum type if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hostel_meals_dayofweek_enum') THEN
          CREATE TYPE "hostel_meals_dayofweek_enum" AS ENUM (
            'SUNDAY',
            'MONDAY',
            'TUESDAY',
            'WEDNESDAY',
            'THURSDAY',
            'FRIDAY',
            'SATURDAY'
          );
        END IF;
      END $$;
    `);

    // 3. Create hostel_meals table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hostel_meals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hostelId" uuid NOT NULL,
        "dayOfWeek" "hostel_meals_dayofweek_enum" NOT NULL,
        "breakfastDescription" character varying(1000) DEFAULT null,
        "breakfastTime" character varying(50) DEFAULT null,
        "breakfastNotes" character varying(500) DEFAULT null,
        "mainMealDescription" character varying(1000) DEFAULT null,
        "mainMealTime" character varying(50) DEFAULT null,
        "mainMealNotes" character varying(500) DEFAULT null,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hostel_meals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hostel_meals_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_hostel_meals_hostel_day" UNIQUE ("hostelId", "dayOfWeek")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hostel_meals_hostel_id" ON "hostel_meals" ("hostelId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostel_meals_hostel_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hostel_meals"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "hostel_meals_dayofweek_enum"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostels_is_location_shared"`);
    await queryRunner.query(
      `ALTER TABLE "hostels" DROP CONSTRAINT IF EXISTS "CK_hostels_longitude_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hostels" DROP CONSTRAINT IF EXISTS "CK_hostels_latitude_range"`,
    );
    await queryRunner.query(`ALTER TABLE "hostels" DROP COLUMN IF EXISTS "locationUpdatedAt"`);
    await queryRunner.query(`ALTER TABLE "hostels" DROP COLUMN IF EXISTS "isLocationShared"`);
    await queryRunner.query(`ALTER TABLE "hostels" DROP COLUMN IF EXISTS "longitude"`);
    await queryRunner.query(`ALTER TABLE "hostels" DROP COLUMN IF EXISTS "latitude"`);
  }
}
