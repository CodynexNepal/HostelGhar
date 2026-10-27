"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBeds1727598200000 = void 0;
class CreateBeds1727598200000 {
    constructor() {
        this.name = 'CreateBeds1727598200000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "bed_status_enum" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "beds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hostelId" uuid NOT NULL,
        "roomId" uuid NOT NULL,
        "bedNumber" character varying(20) NOT NULL,
        "status" "bed_status_enum" NOT NULL DEFAULT 'AVAILABLE',
        "rentAmount" numeric(12,2),
        "ownerId" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_beds" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_beds_hostel_room_bed" UNIQUE ("hostelId", "roomId", "bedNumber"),
        CONSTRAINT "FK_beds_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_beds_room" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_beds_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_beds_hostel_id" ON "beds" ("hostelId")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_beds_room_id" ON "beds" ("roomId")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_beds_owner_id" ON "beds" ("ownerId")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_beds_status" ON "beds" ("status")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "beds"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "bed_status_enum"`);
    }
}
exports.CreateBeds1727598200000 = CreateBeds1727598200000;
