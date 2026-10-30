"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: 1802200000000-AddStudentContactFieldsToBookings.ts
// PURPOSE: Adds studentName, phone, and email fields to bookings table.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddStudentContactFieldsToBookings1802200000000 = void 0;
class AddStudentContactFieldsToBookings1802200000000 {
    constructor() {
        this.name = 'AddStudentContactFieldsToBookings1802200000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "studentName" character varying(150) DEFAULT null`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "phone" character varying(20) DEFAULT null`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "email" character varying(255) DEFAULT null`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "email"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "phone"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "studentName"`);
    }
}
exports.AddStudentContactFieldsToBookings1802200000000 = AddStudentContactFieldsToBookings1802200000000;
