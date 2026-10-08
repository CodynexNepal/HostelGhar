import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHostelSuspendFields1794000000000 implements MigrationInterface {
  name = 'AddHostelSuspendFields1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hostels" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "hostels" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMPTZ DEFAULT null`,
    );
    await queryRunner.query(
      `ALTER TABLE "hostels" ADD COLUMN IF NOT EXISTS "suspendReason" character varying(500) DEFAULT null`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hostels_is_active" ON "hostels" ("isActive")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostels_is_active"`);
    await queryRunner.query(`ALTER TABLE "hostels" DROP COLUMN IF EXISTS "suspendReason"`);
    await queryRunner.query(`ALTER TABLE "hostels" DROP COLUMN IF EXISTS "suspendedAt"`);
    await queryRunner.query(`ALTER TABLE "hostels" DROP COLUMN IF EXISTS "isActive"`);
  }
}
