import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformSettings1795000000000 implements MigrationInterface {
  name = 'CreatePlatformSettings1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "platform_settings" ("section" character varying(32) NOT NULL, "value" jsonb NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT "PK_platform_settings_section" PRIMARY KEY ("section"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_settings"`);
  }
}
