"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateResidentImports1758000000000 = void 0;
class CreateResidentImports1758000000000 {
    constructor() {
        this.name = 'CreateResidentImports1758000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE resident_import_status AS ENUM ('QUEUED','PROCESSING','COMPLETED','COMPLETED_WITH_ERRORS','FAILED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS resident_imports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "hostelId" UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
        "requestedBy" UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        "fileName" VARCHAR(255) NOT NULL,
        status resident_import_status NOT NULL DEFAULT 'QUEUED',
        "totalRows" INTEGER NOT NULL DEFAULT 0,
        "validRows" INTEGER NOT NULL DEFAULT 0,
        "successCount" INTEGER NOT NULL DEFAULT 0,
        "failedCount" INTEGER NOT NULL DEFAULT 0,
        "idempotencyKey" VARCHAR(64),
        "rowErrors" JSONB,
        "failureReason" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "completedAt" TIMESTAMPTZ
      )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_resident_imports_hostel_created ON resident_imports ("hostelId", "createdAt" DESC)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_resident_imports_owner_created ON resident_imports ("requestedBy", "createdAt" DESC)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_resident_imports_status ON resident_imports (status)`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS resident_imports`);
        await queryRunner.query(`DROP TYPE IF EXISTS resident_import_status`);
    }
}
exports.CreateResidentImports1758000000000 = CreateResidentImports1758000000000;
