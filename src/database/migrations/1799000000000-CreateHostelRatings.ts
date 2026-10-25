import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHostelRatings1799000000000 implements MigrationInterface {
  name = 'CreateHostelRatings1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hostel_ratings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hostelId" uuid NOT NULL,
        "userId" uuid,
        "rating" smallint NOT NULL,
        "comment" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hostel_ratings" PRIMARY KEY ("id"),
        CONSTRAINT "CK_hostel_ratings_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5),
        CONSTRAINT "FK_hostel_ratings_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hostel_ratings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hostel_ratings_hostel_id" ON "hostel_ratings" ("hostelId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_hostel_ratings_user_id" ON "hostel_ratings" ("userId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_hostel_ratings_hostel_user" ON "hostel_ratings" ("hostelId", "userId") WHERE "userId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_hostel_ratings_hostel_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostel_ratings_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostel_ratings_hostel_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hostel_ratings"`);
  }
}
