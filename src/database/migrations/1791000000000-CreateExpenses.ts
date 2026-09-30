import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpenses1791000000000 implements MigrationInterface {
  name = 'CreateExpenses1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "expense_category_enum" AS ENUM ('STAFF', 'FOOD', 'MAINTENANCE', 'UTILITIES', 'ELECTRICITY', 'WATER', 'SUPPLIES', 'INTERNET', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "expense_status_enum" AS ENUM ('PENDING', 'PAID', 'CANCELLED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "expenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hostelId" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "category" "expense_category_enum" NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "expenseDate" date NOT NULL,
        "notes" text,
        "status" "expense_status_enum" NOT NULL DEFAULT 'PAID',
        "createdById" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_expenses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_expenses_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_expenses_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_expenses_hostel_date" ON "expenses" ("hostelId", "expenseDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_expenses_hostel_category" ON "expenses" ("hostelId", "category")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_expenses_status" ON "expenses" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "expense_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "expense_category_enum"`);
  }
}
