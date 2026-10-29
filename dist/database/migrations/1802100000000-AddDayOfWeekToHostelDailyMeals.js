"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: 1802100000000-AddDayOfWeekToHostelDailyMeals.ts
// PURPOSE: Adds dayOfWeek column and index to hostel_daily_meals table.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddDayOfWeekToHostelDailyMeals1802100000000 = void 0;
class AddDayOfWeekToHostelDailyMeals1802100000000 {
    constructor() {
        this.name = 'AddDayOfWeekToHostelDailyMeals1802100000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "hostel_daily_meals" ADD COLUMN IF NOT EXISTS "dayOfWeek" character varying(20) NOT NULL DEFAULT 'ALL'`);
        await queryRunner.query(`UPDATE "hostel_daily_meals" SET "dayOfWeek" = 'ALL' WHERE "dayOfWeek" IS NULL OR "dayOfWeek" = ''`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_hostel_daily_meals_hostel_day_order" ON "hostel_daily_meals" ("hostelId", "dayOfWeek", "orderIndex")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostel_daily_meals_hostel_day_order"`);
        await queryRunner.query(`ALTER TABLE "hostel_daily_meals" DROP COLUMN IF EXISTS "dayOfWeek"`);
    }
}
exports.AddDayOfWeekToHostelDailyMeals1802100000000 = AddDayOfWeekToHostelDailyMeals1802100000000;
