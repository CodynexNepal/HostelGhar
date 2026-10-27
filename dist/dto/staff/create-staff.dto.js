"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-staff.dto.ts
// PURPOSE: Validation for Owner/Admin creating a staff member of a hostel.
// Accepts JSON or multipart/form-data (photo file under `photo` field).
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
exports.CreateStaffDto = void 0;
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
    // Alias: SECURITY GUARD commonly typed as GUARD
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
class CreateStaffDto {
}
exports.CreateStaffDto = CreateStaffDto;
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsUUID)('4', { message: 'hostelId must be a valid UUID' }),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "hostelId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Full name is required' }),
    (0, class_validator_1.MinLength)(2, { message: 'Full name must be at least 2 characters' }),
    (0, class_validator_1.MaxLength)(120, { message: 'Full name must be at most 120 characters' }),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "fullName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Phone number is required' }),
    (0, class_validator_1.Matches)(/^[0-9+\- ]{7,20}$/, { message: 'Phone number looks invalid' }),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "phone", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => normalizeEnumValue(value)),
    (0, class_validator_1.IsEnum)(staff_enum_1.StaffRole, {
        message: 'Role must be one of: WARDEN, MANAGER, COOK, CLEANER, GUARD, ACCOUNTANT, RECEPTIONIST, MAINTENANCE, DRIVER, OTHER',
    }),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "role", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => normalizeEnumValue(value)),
    (0, class_validator_1.IsEnum)(staff_enum_1.StaffShift, { message: 'Shift must be one of: DAY, NIGHT, MORNING, EVENING, FULL_DAY' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "shift", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => normalizeEnumValue(value)),
    (0, class_validator_1.IsEnum)(staff_enum_1.StaffStatus, { message: 'Status must be one of: ACTIVE, INACTIVE, ON_LEAVE, TERMINATED' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsEmail)({}, { message: 'Email must be valid' }),
    (0, class_validator_1.MaxLength)(255),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "email", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'Monthly salary must be a number' }),
    (0, class_validator_1.IsPositive)({ message: 'Monthly salary must be positive' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateStaffDto.prototype, "monthlySalary", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9+\- ]{7,20}$/, { message: 'Emergency contact looks invalid' }),
    (0, class_validator_1.MaxLength)(20),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "emergencyContact", void 0);
