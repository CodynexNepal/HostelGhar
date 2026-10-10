import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformQrs1796000000000 implements MigrationInterface {
  name = 'CreatePlatformQrs1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "platform_qr_method_enum" AS ENUM ('ESEWA', 'KHALTI', 'BANK')`,
    );
    await queryRunner.query(`
      CREATE TABLE "platform_qrs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "method" "platform_qr_method_enum" NOT NULL,
        "qrImageUrl" text NOT NULL,
        "qrImagePublicId" character varying(255),
        "label" character varying(255) NOT NULL DEFAULT '',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_qrs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_qrs_method" UNIQUE ("method")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_qrs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "platform_qr_method_enum"`);
  }
}
