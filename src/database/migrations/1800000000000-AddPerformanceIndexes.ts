import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1800000000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_password_reset_token" ON "users" ("passwordResetToken") WHERE "passwordResetToken" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_fees_resident_month_year_type" ON "fees" ("residentId", "billingMonth", "billingYear", "feeType")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fees_resident_month_year_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_password_reset_token"`);
  }
}
