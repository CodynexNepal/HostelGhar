"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-staff.dto.ts
// PURPOSE: Partial validation for updating a hostel staff member.
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
exports.UpdateStaffDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const staff_enum_1 = require("../../enum/staff.enum");
const normalizeEnumValue = (value) => {
    if (typeof value !== 'string')
        return value;
    const trimmed = value.trim();
    if (!trimmed)
        return trimmed;
    let upper = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
    if (upper === 'SECURITYGUARD')
        upper = 'SECURITY_GUARD';
    if (upper === 'SECURITY')
        upper = 'GUARD';
    if (upper === 'FULLDAY' || upper === 'FULL-DAY' || upper === 'FULL DAY')
        upper = 'FULL_DAY';
    if (upper === 'ONLEAVE' || upper === 'ON-LEAVE' || upper === 'ON LEAVE')
        upper = 'ON_LEAVE';
    return upper;
};
class UpdateStaffDto {
}
exports.UpdateStaffDto = UpdateStaffDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2, { message: 'Full name must be at least 2 characters' }),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateStaffDto.prototype, "fullName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9+\- ]{7,20}$/, { message: 'Phone number looks invalid' }),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], UpdateStaffDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => normalizeEnumValue(value)),
    (0, class_validator_1.IsEnum)(staff_enum_1.StaffRole, { message: 'Role must be a valid staff role' }),
    __metadata("design:type", String)
], UpdateStaffDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => normalizeEnumValue(value)),
    (0, class_validator_1.IsEnum)(staff_enum_1.StaffShift, { message: 'Shift must be a valid shift' }),
    __metadata("design:type", String)
], UpdateStaffDto.prototype, "shift", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => normalizeEnumValue(value)),
    (0, class_validator_1.IsEnum)(staff_enum_1.StaffStatus, { message: 'Status must be a valid status' }),
    __metadata("design:type", String)
], UpdateStaffDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)({}, { message: 'Email must be valid' }),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", Object)
], UpdateStaffDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'Monthly salary must be a number' }),
    (0, class_validator_1.IsPositive)({ message: 'Monthly salary must be positive' }),
    __metadata("design:type", Object)
], UpdateStaffDto.prototype, "monthlySalary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", Object)
], UpdateStaffDto.prototype, "emergencyContact", void 0);
