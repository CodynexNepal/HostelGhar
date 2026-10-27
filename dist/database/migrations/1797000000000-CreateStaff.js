"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateStaff1797000000000 = void 0;
class CreateStaff1797000000000 {
    constructor() {
        this.name = 'CreateStaff1797000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "staff_role_enum" AS ENUM ('WARDEN', 'MANAGER', 'COOK', 'CLEANER', 'GUARD', 'SECURITY_GUARD', 'ACCOUNTANT', 'RECEPTIONIST', 'MAINTENANCE', 'DRIVER', 'OTHER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "staff_shift_enum" AS ENUM ('DAY', 'NIGHT', 'MORNING', 'EVENING', 'FULL_DAY');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "staff_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "staff" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hostelId" uuid NOT NULL,
        "fullName" character varying(120) NOT NULL,
        "phone" character varying(20) NOT NULL,
        "role" "staff_role_enum" NOT NULL,
        "shift" "staff_shift_enum" NOT NULL DEFAULT 'DAY',
        "status" "staff_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "email" character varying(255),
        "monthlySalary" numeric(12,2),
        "emergencyContact" character varying(20),
        "photoUrl" character varying(500),
        "photoPublicId" character varying(255),
        "createdById" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_staff" PRIMARY KEY ("id"),
        CONSTRAINT "FK_staff_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_staff_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_staff_hostel" ON "staff" ("hostelId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_staff_hostel_status" ON "staff" ("hostelId", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_staff_hostel_role" ON "staff" ("hostelId", "role")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "staff"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "staff_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "staff_shift_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "staff_role_enum"`);
    }
}
exports.CreateStaff1797000000000 = CreateStaff1797000000000;
