import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentProofs1790294400000 implements MigrationInterface {
  name = 'CreatePaymentProofs1790294400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "payment_proof_method_enum" AS ENUM ('ESEWA', 'KHALTI', 'BANK', 'CASH')
    `);

    await queryRunner.query(`
      CREATE TYPE "payment_proof_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED')
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_proofs" (
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
      CREATE INDEX "idx_payment_proofs_hostel_status" ON "payment_proofs" ("hostelId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_payment_proofs_resident" ON "payment_proofs" ("residentId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_payment_proofs_fee" ON "payment_proofs" ("feeId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_proofs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_proof_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_proof_method_enum"`);
  }
}
