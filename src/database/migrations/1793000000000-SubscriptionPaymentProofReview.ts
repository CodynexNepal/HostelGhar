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
        ADD COLUMN IF NOT EXISTS "paymentMethod" "payment_proof_method_enum" DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "proofUrl" character varying(500) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "proofPublicId" character varying(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "reviewedBy" uuid DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMPTZ DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "reviewNote" text DEFAULT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "subscriptions"
          ADD CONSTRAINT "FK_subscriptions_reviewed_by"
          FOREIGN KEY ("reviewedBy") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
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
  }
}
