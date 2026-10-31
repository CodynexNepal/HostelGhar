"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: mark-attendance.dto.ts
// PURPOSE: Validation for a Resident self check-in / check-out.
//          Residents may only mark themselves PRESENT or LATE — absence
//          marking is an owner/admin action, not a self-service one.
//          Allows optional hostelId, address, and device GPS coordinates
//          for geofencing verification, with optional hostel location sync.
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
exports.CheckOutAttendanceDto = exports.MarkAttendanceDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const attendance_enum_1 = require("../../enum/attendance.enum");
const normalizeEnumValue = (value) => {
    if (typeof value !== 'string')
        return value;
    const trimmed = value.trim();
    if (!trimmed)
        return trimmed;
    return trimmed.toUpperCase().replace(/[\s-]+/g, '_');
};
// Self check-in statuses a resident may pick. ABSENT / HALF_DAY / ON_LEAVE
// are owner-controlled and rejected here by the @IsIn whitelist.
const RESIDENT_CHECK_IN_STATUSES = [attendance_enum_1.AttendanceStatus.PRESENT, attendance_enum_1.AttendanceStatus.LATE];
class MarkAttendanceDto {
}
exports.MarkAttendanceDto = MarkAttendanceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "hostelId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'latitude must be a valid number' }),
    (0, class_validator_1.Min)(-90, { message: 'latitude must be >= -90' }),
    (0, class_validator_1.Max)(90, { message: 'latitude must be <= 90' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], MarkAttendanceDto.prototype, "latitude", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'longitude must be a valid number' }),
    (0, class_validator_1.Min)(-180, { message: 'longitude must be >= -180' }),
    (0, class_validator_1.Max)(180, { message: 'longitude must be <= 180' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], MarkAttendanceDto.prototype, "longitude", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], MarkAttendanceDto.prototype, "syncHostelLocation", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], MarkAttendanceDto.prototype, "recordAsHostelLocation", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => normalizeEnumValue(value)),
    (0, class_validator_1.IsIn)(RESIDENT_CHECK_IN_STATUSES, {
        message: 'status must be PRESENT or LATE for self check-in',
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500, { message: 'note must be at most 500 characters' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "note", void 0);
class CheckOutAttendanceDto {
}
exports.CheckOutAttendanceDto = CheckOutAttendanceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CheckOutAttendanceDto.prototype, "hostelId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'latitude must be a valid number' }),
    (0, class_validator_1.Min)(-90, { message: 'latitude must be >= -90' }),
    (0, class_validator_1.Max)(90, { message: 'latitude must be <= 90' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CheckOutAttendanceDto.prototype, "latitude", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'longitude must be a valid number' }),
    (0, class_validator_1.Min)(-180, { message: 'longitude must be >= -180' }),
    (0, class_validator_1.Max)(180, { message: 'longitude must be <= 180' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CheckOutAttendanceDto.prototype, "longitude", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500, { message: 'note must be at most 500 characters' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CheckOutAttendanceDto.prototype, "note", void 0);
