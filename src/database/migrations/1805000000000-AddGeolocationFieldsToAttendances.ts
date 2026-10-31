import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeolocationFieldsToAttendances1805000000000 implements MigrationInterface {
  name = 'AddGeolocationFieldsToAttendances1805000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendances"
      ADD COLUMN IF NOT EXISTS "checkInLatitude" numeric(10, 7) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkInLongitude" numeric(10, 7) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkOutLatitude" numeric(10, 7) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkOutLongitude" numeric(10, 7) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkInIp" varchar(45) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkOutIp" varchar(45) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkInAddress" varchar(255) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkOutAddress" varchar(255) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkInDistanceMeters" numeric(10, 2) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkOutDistanceMeters" numeric(10, 2) DEFAULT null
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendances"
      DROP COLUMN IF EXISTS "checkInLatitude",
      DROP COLUMN IF EXISTS "checkInLongitude",
      DROP COLUMN IF EXISTS "checkOutLatitude",
      DROP COLUMN IF EXISTS "checkOutLongitude",
      DROP COLUMN IF EXISTS "checkInIp",
      DROP COLUMN IF EXISTS "checkOutIp",
      DROP COLUMN IF EXISTS "checkInDistanceMeters",
      DROP COLUMN IF EXISTS "checkOutDistanceMeters"
    `);
  }
}
