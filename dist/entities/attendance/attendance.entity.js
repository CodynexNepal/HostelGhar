"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.entity.ts
// PURPOSE: Daily resident attendance records (one row per resident per day).
//          Residents self check-in; owners/admins view per hostel.
// ──────────────────────────────────────────────────────────────────────────────
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attendance = void 0;
const typeorm_1 = require("typeorm");
const hostel_entity_1 = require("../hostel/hostel.entity");
const resident_entity_1 = require("../resident/resident.entity");
const user_entity_1 = require("../user.entity");
const attendance_enum_1 = require("../../enum/attendance.enum");
let Attendance = class Attendance {
};
exports.Attendance = Attendance;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Attendance.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Attendance.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, { onDelete: 'CASCADE', nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], Attendance.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Attendance.prototype, "residentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => resident_entity_1.Resident, { onDelete: 'CASCADE', nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'residentId' }),
    __metadata("design:type", resident_entity_1.Resident)
], Attendance.prototype, "resident", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: false }),
    __metadata("design:type", String)
], Attendance.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: attendance_enum_1.AttendanceStatus,
        nullable: false,
        default: attendance_enum_1.AttendanceStatus.PRESENT,
    }),
    __metadata("design:type", String)
], Attendance.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true, default: null }),
    __metadata("design:type", Object)
], Attendance.prototype, "checkInAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true, default: null }),
    __metadata("design:type", Object)
], Attendance.prototype, "checkOutAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'double precision',
        nullable: true,
        default: null,
        transformer: {
            to: (value) => value,
            from: (value) => (value != null ? parseFloat(String(value)) : null),
        },
    }),
    __metadata("design:type", Object)
], Attendance.prototype, "checkInLatitude", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'double precision',
        nullable: true,
        default: null,
        transformer: {
            to: (value) => value,
            from: (value) => (value != null ? parseFloat(String(value)) : null),
        },
    }),
    __metadata("design:type", Object)
], Attendance.prototype, "checkInLongitude", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'double precision',
        nullable: true,
        default: null,
        transformer: {
            to: (value) => value,
            from: (value) => (value != null ? parseFloat(String(value)) : null),
        },
    }),
    __metadata("design:type", Object)
], Attendance.prototype, "checkOutLatitude", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'double precision',
        nullable: true,
        default: null,
        transformer: {
            to: (value) => value,
            from: (value) => (value != null ? parseFloat(String(value)) : null),
        },
    }),
    __metadata("design:type", Object)
], Attendance.prototype, "checkOutLongitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 45, nullable: true, default: null }),
    __metadata("design:type", Object)
], Attendance.prototype, "checkInIp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 45, nullable: true, default: null }),
    __metadata("design:type", Object)
], Attendance.prototype, "checkOutIp", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'numeric',
        precision: 10,
        scale: 2,
        nullable: true,
        default: null,
        transformer: {
            to: (value) => value,
            from: (value) => (value != null ? parseFloat(value) : null),
        },
    }),
    __metadata("design:type", Object)
], Attendance.prototype, "checkInDistanceMeters", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'numeric',
        precision: 10,
        scale: 2,
        nullable: true,
        default: null,
        transformer: {
            to: (value) => value,
            from: (value) => (value != null ? parseFloat(value) : null),
        },
    }),
    __metadata("design:type", Object)
], Attendance.prototype, "checkOutDistanceMeters", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, default: null }),
    __metadata("design:type", Object)
], Attendance.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true, default: null }),
    __metadata("design:type", Object)
], Attendance.prototype, "recordedById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'recordedById' }),
    __metadata("design:type", Object)
], Attendance.prototype, "recordedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Attendance.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Attendance.prototype, "updatedAt", void 0);
exports.Attendance = Attendance = __decorate([
    (0, typeorm_1.Entity)('attendances'),
    (0, typeorm_1.Unique)('uq_attendances_resident_date', ['residentId', 'date']),
    (0, typeorm_1.Index)('idx_attendances_hostel_date', ['hostelId', 'date']),
    (0, typeorm_1.Index)('idx_attendances_resident_date', ['residentId', 'date'])
], Attendance);
