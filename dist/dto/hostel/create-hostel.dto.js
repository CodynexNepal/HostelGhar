"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-hostel.dto.ts
// PURPOSE: Request validation DTO for Admin creating a Hostel.
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
exports.CreateHostelDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const hostel_enum_1 = require("../../enum/hostel.enum");
// Multer sends multipart fields as strings; an untouched optional input often
// arrives as "" — convert it to undefined so @IsOptional() skips it instead
// of failing e.g. @IsEmail("").
const emptyToUndefined = ({ value }) => value === '' || (typeof value === 'string' && value.trim() === '') ? undefined : value;
class CreateHostelDto {
}
exports.CreateHostelDto = CreateHostelDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Hostel name is required' }),
    (0, class_validator_1.MaxLength)(120, { message: 'Hostel name must not exceed 120 characters' }),
    __metadata("design:type", String)
], CreateHostelDto.prototype, "name", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)),
    (0, class_validator_1.IsEnum)(hostel_enum_1.HostelType, { message: 'Type must be either BOYS or GIRLS' }),
    __metadata("design:type", String)
], CreateHostelDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(emptyToUndefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateHostelDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(emptyToUndefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateHostelDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(emptyToUndefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20)
    // Loose phone check — accepts local numbers like "9867567898".
    // Use @IsPhoneNumber('NP') here only if ALL hostels are Nepali numbers.
    ,
    __metadata("design:type", String)
], CreateHostelDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(emptyToUndefined),
    (0, class_validator_1.IsEmail)({}, { message: 'Please provide a valid hostel email address' }),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateHostelDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(emptyToUndefined),
    (0, class_validator_1.IsUUID)('4', { message: 'Owner ID must be a valid UUID v4' }),
    __metadata("design:type", String)
], CreateHostelDto.prototype, "ownerId", void 0);
