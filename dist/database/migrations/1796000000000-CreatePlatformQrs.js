"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePlatformQrs1796000000000 = void 0;
class CreatePlatformQrs1796000000000 {
    constructor() {
        this.name = 'CreatePlatformQrs1796000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "platform_qr_method_enum" AS ENUM ('ESEWA', 'KHALTI', 'BANK');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_qrs" (
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
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "platform_qrs"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "platform_qr_method_enum"`);
    }
}
exports.CreatePlatformQrs1796000000000 = CreatePlatformQrs1796000000000;
