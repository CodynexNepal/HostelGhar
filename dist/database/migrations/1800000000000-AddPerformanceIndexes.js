"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPerformanceIndexes1800000000000 = void 0;
class AddPerformanceIndexes1800000000000 {
    constructor() {
        this.name = 'AddPerformanceIndexes1800000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_password_reset_token" ON "users" ("passwordResetToken") WHERE "passwordResetToken" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_fees_resident_month_year_type" ON "fees" ("residentId", "billingMonth", "billingYear", "feeType")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_fees_resident_month_year_type"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_password_reset_token"`);
    }
}
exports.AddPerformanceIndexes1800000000000 = AddPerformanceIndexes1800000000000;
