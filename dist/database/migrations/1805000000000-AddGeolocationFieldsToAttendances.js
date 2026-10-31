"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddGeolocationFieldsToAttendances1805000000000 = void 0;
class AddGeolocationFieldsToAttendances1805000000000 {
    constructor() {
        this.name = 'AddGeolocationFieldsToAttendances1805000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "attendances"
      ADD COLUMN IF NOT EXISTS "checkInLatitude" numeric(10, 7) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkInLongitude" numeric(10, 7) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkOutLatitude" numeric(10, 7) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkOutLongitude" numeric(10, 7) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkInIp" varchar(45) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkOutIp" varchar(45) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkInDistanceMeters" numeric(10, 2) DEFAULT null,
      ADD COLUMN IF NOT EXISTS "checkOutDistanceMeters" numeric(10, 2) DEFAULT null
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "attendances"
      DROP COLUMN IF EXISTS "checkInLatitude",
      DROP COLUMN IF EXISTS "checkInLongitude",
      DROP COLUMN IF EXISTS "checkOutLatitude",
      DROP COLUMN IF EXISTS "checkOutLongitude",
      DROP COLUMN IF EXISTS "checkInIp",
      DROP COLUMN IF EXISTS "checkOutIp",
      DROP COLUMN IF EXISTS "checkInDistanceMeters",
      DROP COLUMN IF EXISTS "checkOutDistanceMeters"
    `);
    }
}
exports.AddGeolocationFieldsToAttendances1805000000000 = AddGeolocationFieldsToAttendances1805000000000;
