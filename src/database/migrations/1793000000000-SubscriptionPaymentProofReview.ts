import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Subscription payment-proof workflow: owners no longer activate a paid plan
 * instantly — they upload a payment screenshot, the row stays PENDING until an
 * admin approves (ACTIVE) or rejects (REJECTED) it.
 */
export class SubscriptionPaymentProofReview1793000000000 implements MigrationInterface {
  name = 'SubscriptionPaymentProofReview1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // New terminal state for a rejected request (IF NOT EXISTS is a no-op when
    // the value is already present, so re-runs stay safe).
    await queryRunner.query(
      `ALTER TYPE "subscription_status_enum" ADD VALUE IF NOT EXISTS 'REJECTED'`,
    );

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ADD COLUMN "paymentMethod" "payment_proof_method_enum" DEFAULT NULL,
        ADD COLUMN "proofUrl" character varying(500) DEFAULT NULL,
        ADD COLUMN "proofPublicId" character varying(255) DEFAULT NULL,
        ADD COLUMN "reviewedBy" uuid DEFAULT NULL,
        ADD COLUMN "reviewedAt" TIMESTAMPTZ DEFAULT NULL,
        ADD COLUMN "reviewNote" text DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ADD CONSTRAINT "FK_subscriptions_reviewed_by"
        FOREIGN KEY ("reviewedBy") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "FK_subscriptions_reviewed_by"`,
    );
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        DROP COLUMN IF EXISTS "reviewNote",
        DROP COLUMN IF EXISTS "reviewedAt",
        DROP COLUMN IF EXISTS "reviewedBy",
        DROP COLUMN IF EXISTS "proofPublicId",
        DROP COLUMN IF EXISTS "proofUrl",
        DROP COLUMN IF EXISTS "paymentMethod"
    `);
    // Postgres cannot remove a value from an enum type — 'REJECTED' stays.
  }
}
