import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttendances1798000000000 implements MigrationInterface {
  name = 'CreateAttendances1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "attendance_status_enum" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "attendances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hostelId" uuid NOT NULL,
        "residentId" uuid NOT NULL,
        "date" date NOT NULL,
        "status" "attendance_status_enum" NOT NULL DEFAULT 'PRESENT',
        "checkInAt" TIMESTAMPTZ,
        "checkOutAt" TIMESTAMPTZ,
        "note" character varying(500),
        "recordedById" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attendances" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_attendances_resident_date" UNIQUE ("residentId", "date"),
        CONSTRAINT "FK_attendances_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attendances_resident" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attendances_recorded_by" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attendances_hostel_date" ON "attendances" ("hostelId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attendances_resident_date" ON "attendances" ("residentId", "date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendances"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "attendance_status_enum"`);
  }
}
