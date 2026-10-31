"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePaymentsAndEnhanceFees1804000000000 = void 0;
class CreatePaymentsAndEnhanceFees1804000000000 {
    constructor() {
        this.name = 'CreatePaymentsAndEnhanceFees1804000000000';
    }
    async up(queryRunner) {
        // 1. Update fees_status_enum to include CANCELLED if missing
        await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fees_status_enum') THEN
          ALTER TYPE "fees_status_enum" ADD VALUE IF NOT EXISTS 'CANCELLED';
        END IF;
      END $$;
    `);
        // 2. Add invoiceNumber, discountAmount, outstandingAmount to fees
        await queryRunner.query(`
      ALTER TABLE "fees" 
        ADD COLUMN IF NOT EXISTS "invoiceNumber" character varying(100),
        ADD COLUMN IF NOT EXISTS "discountAmount" numeric(10,2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS "outstandingAmount" numeric(10,2) NOT NULL DEFAULT 10500.00;
    `);
        // Backfill existing fees
        await queryRunner.query(`
      UPDATE "fees"
      SET "outstandingAmount" = GREATEST(0, "totalPayable" - "paidAmount")
      WHERE "outstandingAmount" IS NULL OR "outstandingAmount" = 10500.00;

      UPDATE "fees"
      SET "invoiceNumber" = 'INV-' || "billingYear"::text || LPAD("billingMonth"::text, 2, '0') || '-' || UPPER(SUBSTRING("id"::text, 1, 8))
      WHERE "invoiceNumber" IS NULL;
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_fees_invoice_number" ON "fees" ("invoiceNumber");
    `);
        // 3. Create payment enum types
        await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
          CREATE TYPE "payment_method_enum" AS ENUM ('CASH', 'ESEWA', 'KHALTI', 'BANK_TRANSFER', 'OTHER');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
          CREATE TYPE "payment_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
        END IF;
      END $$;
    `);
        // 4. Create payments table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceId" uuid NOT NULL,
        "residentId" uuid NOT NULL,
        "hostelId" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "paymentMethod" "payment_method_enum" NOT NULL DEFAULT 'CASH',
        "paymentStatus" "payment_status_enum" NOT NULL DEFAULT 'SUCCESS',
        "transactionReference" character varying(100),
        "idempotencyKey" character varying(150),
        "receiptNumber" character varying(100),
        "receivedBy" uuid,
        "paidAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "remarks" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_idempotency_key" UNIQUE ("idempotencyKey"),
        CONSTRAINT "FK_payments_fee" FOREIGN KEY ("invoiceId") REFERENCES "fees"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_resident" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_user" FOREIGN KEY ("receivedBy") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_invoice" ON "payments" ("invoiceId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_resident" ON "payments" ("residentId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_hostel_paid_at" ON "payments" ("hostelId", "paidAt");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_transaction_ref" ON "payments" ("transactionReference");`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "payments";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_fees_invoice_number";`);
        await queryRunner.query(`
      ALTER TABLE "fees" 
        DROP COLUMN IF EXISTS "outstandingAmount",
        DROP COLUMN IF EXISTS "discountAmount",
        DROP COLUMN IF EXISTS "invoiceNumber";
    `);
    }
}
exports.CreatePaymentsAndEnhanceFees1804000000000 = CreatePaymentsAndEnhanceFees1804000000000;
