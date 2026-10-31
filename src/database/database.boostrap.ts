// ──────────────────────────────────────────────────────────────────────────────
// FILE: database.boostrap.ts
// PURPOSE: Provides a single async function that initializes the TypeORM
//          DataSource (opens the connection pool). This function is called
//          once at application startup, BEFORE the Express server begins
//          accepting HTTP requests.
//
// WHY SEPARATE FROM database-source.ts? The DataSource object is a
// *configuration* — it describes HOW to connect. This file contains the
// *action* — it actually OPENS the connection. Separating the two means
// we can import the DataSource config in test/migration scripts without
// triggering an automatic connection.
// ──────────────────────────────────────────────────────────────────────────────

// Import the configured DataSource singleton. At this point no connection
// has been opened yet — TypeORM defers connection until `.initialize()`.
import { AppDataSource } from './database-source';

// ─── Bootstrap Function ─────────────────────────────────────────────────────

// Exported as an async function because `.initialize()` returns a Promise.
// The caller (index.ts) must `await` this before starting the HTTP server
// to guarantee that all database queries will succeed.
export const bootstrapDatabase = async (): Promise<void> => {
  try {
    // `.initialize()` opens the PostgreSQL connection pool using the
    // configuration defined in database-source.ts. If the connection fails
    // (wrong credentials, network issue), it throws — which we catch below.
    await AppDataSource.initialize();

    // Ensure daily meals table and dayOfWeek column exist (self-healing schema check)
    try {
      await AppDataSource.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables WHERE table_name = 'hostel_daily_meals'
          ) THEN
            ALTER TABLE "hostel_daily_meals" ADD COLUMN IF NOT EXISTS "dayOfWeek" character varying(20) NOT NULL DEFAULT 'ALL';
            UPDATE "hostel_daily_meals" SET "dayOfWeek" = 'ALL' WHERE "dayOfWeek" IS NULL OR "dayOfWeek" = '';
            CREATE INDEX IF NOT EXISTS "idx_hostel_daily_meals_hostel_day_order" ON "hostel_daily_meals" ("hostelId", "dayOfWeek", "orderIndex");
          END IF;

          -- Self-healing check for bookings status enum to support APPROVED and CONFIRMED
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bookings_status_enum') THEN
            ALTER TYPE "bookings_status_enum" ADD VALUE IF NOT EXISTS 'APPROVED';
            ALTER TYPE "bookings_status_enum" ADD VALUE IF NOT EXISTS 'CONFIRMED';
          END IF;

          -- Self-healing check for fees status enum to support CANCELLED
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fees_status_enum') THEN
            ALTER TYPE "fees_status_enum" ADD VALUE IF NOT EXISTS 'CANCELLED';
          END IF;

          -- Ensure fees table has invoiceNumber, discountAmount, outstandingAmount
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fees') THEN
            ALTER TABLE "fees" ADD COLUMN IF NOT EXISTS "invoiceNumber" character varying(100);
            ALTER TABLE "fees" ADD COLUMN IF NOT EXISTS "discountAmount" numeric(10,2) NOT NULL DEFAULT 0.00;
            ALTER TABLE "fees" ADD COLUMN IF NOT EXISTS "outstandingAmount" numeric(10,2) NOT NULL DEFAULT 10500.00;
            UPDATE "fees" SET "outstandingAmount" = GREATEST(0, "totalPayable" - "paidAmount") WHERE "outstandingAmount" IS NULL;
            UPDATE "fees" SET "invoiceNumber" = 'INV-' || "billingYear"::text || LPAD("billingMonth"::text, 2, '0') || '-' || UPPER(SUBSTRING("id"::text, 1, 8)) WHERE "invoiceNumber" IS NULL;
            CREATE INDEX IF NOT EXISTS "idx_fees_invoice_number" ON "fees" ("invoiceNumber");
          END IF;

          -- Ensure payment enums exist
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
            CREATE TYPE "payment_method_enum" AS ENUM ('CASH', 'ESEWA', 'KHALTI', 'BANK_TRANSFER', 'OTHER');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
            CREATE TYPE "payment_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
          END IF;

          -- Ensure payments table exists
          IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
            CREATE TABLE "payments" (
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
            CREATE INDEX IF NOT EXISTS "idx_payments_invoice" ON "payments" ("invoiceId");
            CREATE INDEX IF NOT EXISTS "idx_payments_resident" ON "payments" ("residentId");
            CREATE INDEX IF NOT EXISTS "idx_payments_hostel_paid_at" ON "payments" ("hostelId", "paidAt");
            CREATE INDEX IF NOT EXISTS "idx_payments_transaction_ref" ON "payments" ("transactionReference");
          END IF;
        END $$;
      `);
    } catch (schemaErr) {
      console.warn('⚠️ Non-blocking schema check notice for schema migrations:', schemaErr);
    }

    // Log success so operators can confirm the DB is connected in server logs.
    // In production, this could be replaced with a structured logger (winston/pino).
    console.log('✅ Database connection established successfully');
  } catch (error) {
    // Log the full error object so operators can diagnose the failure
    // (e.g., "password authentication failed", "connection refused").
    console.error('❌ Database connection failed:', error);

    // `process.exit(1)` terminates the Node process with a non-zero exit code.
    // This is intentional — there is NO point in running an API server that
    // cannot reach its database. The process manager (Docker, PM2, systemd)
    // will detect the non-zero exit and attempt a restart.
    process.exit(1);
  }
};
