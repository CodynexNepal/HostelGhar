"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePlatformSettings1795000000000 = void 0;
class CreatePlatformSettings1795000000000 {
    constructor() {
        this.name = 'CreatePlatformSettings1795000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "platform_settings" ("section" character varying(32) NOT NULL, "value" jsonb NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT "PK_platform_settings_section" PRIMARY KEY ("section"))`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "platform_settings"`);
    }
}
exports.CreatePlatformSettings1795000000000 = CreatePlatformSettings1795000000000;
