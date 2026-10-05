import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptions1792000000000 implements MigrationInterface {
  name = 'CreateSubscriptions1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "subscription_plan_enum" AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "subscription_status_enum" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING')`,
    );
    await queryRunner.query(
      `CREATE TYPE "subscription_billing_cycle_enum" AS ENUM ('MONTHLY', 'YEARLY')`,
    );
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL,
        "hostelId" uuid,
        "plan" "subscription_plan_enum" NOT NULL DEFAULT 'FREE',
        "status" "subscription_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "billingCycle" "subscription_billing_cycle_enum" NOT NULL DEFAULT 'MONTHLY',
        "price" numeric(10,2) NOT NULL DEFAULT 0,
        "currency" character varying(10) NOT NULL DEFAULT 'NPR',
        "startDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "endDate" TIMESTAMPTZ,
        "autoRenew" boolean NOT NULL DEFAULT false,
        "cancelledAt" TIMESTAMPTZ,
        "paymentReference" character varying(255),
        "notes" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subscriptions_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_subscriptions_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_subscriptions_owner_id" ON "subscriptions" ("ownerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_subscriptions_hostel_id" ON "subscriptions" ("hostelId")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_subscriptions_plan" ON "subscriptions" ("plan")`);
    await queryRunner.query(
      `CREATE INDEX "idx_subscriptions_status" ON "subscriptions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_subscriptions_owner_active" ON "subscriptions" ("ownerId", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_billing_cycle_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_plan_enum"`);
  }
}
