"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-resident.dto.ts
// PURPOSE: Request validation DTO for Owner creating/assigning a resident.
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
exports.CreateResidentDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateResidentDto {
}
exports.CreateResidentDto = CreateResidentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Resident name is required' }),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateResidentDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'A valid email is required' }),
    __metadata("design:type", String)
], CreateResidentDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6, { message: 'Temporary password must be at least 6 characters' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateResidentDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Phone is required' }),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], CreateResidentDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4', { message: 'Hostel ID must be a valid UUID' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateResidentDto.prototype, "hostelId", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: 'Flat must be an integer' }),
    (0, class_validator_1.Min)(0, { message: 'Flat cannot be negative' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateResidentDto.prototype, "flat", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Room number is required' }),
    __metadata("design:type", String)
], CreateResidentDto.prototype, "roomNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Bed number is required' }),
    __metadata("design:type", String)
], CreateResidentDto.prototype, "bedNumber", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: 'Monthly rent must be a number' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateResidentDto.prototype, "monthlyRent", void 0);
