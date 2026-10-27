"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePaymentProofs1790294400000 = void 0;
class CreatePaymentProofs1790294400000 {
    constructor() {
        this.name = 'CreatePaymentProofs1790294400000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payment_proof_method_enum" AS ENUM ('ESEWA', 'KHALTI', 'BANK', 'CASH');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payment_proof_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_proofs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "feeId" uuid NOT NULL,
        "hostelId" uuid NOT NULL,
        "residentId" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "method" "payment_proof_method_enum" NOT NULL DEFAULT 'ESEWA',
        "transactionRef" character varying(100),
        "remarks" text,
        "imageUrl" character varying(500),
        "imagePublicId" character varying(255),
        "status" "payment_proof_status_enum" NOT NULL DEFAULT 'PENDING',
        "reviewNote" text,
        "reviewedBy" uuid,
        "reviewedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_proofs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_proofs_fee" FOREIGN KEY ("feeId") REFERENCES "fees"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_payment_proofs_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_payment_proofs_resident" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_payment_proofs_reviewed_by" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_proofs_hostel_status" ON "payment_proofs" ("hostelId", "status")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_proofs_resident" ON "payment_proofs" ("residentId")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_proofs_fee" ON "payment_proofs" ("feeId")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "payment_proofs"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "payment_proof_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "payment_proof_method_enum"`);
    }
}
exports.CreatePaymentProofs1790294400000 = CreatePaymentProofs1790294400000;
