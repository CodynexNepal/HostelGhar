"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-booking.dto.ts
// PURPOSE: DTO and request interface for users with role 'USER' to book a hostel room.
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
exports.CreateBookingDto = void 0;
const class_validator_1 = require("class-validator");
class CreateBookingDto {
}
exports.CreateBookingDto = CreateBookingDto;
__decorate([
    (0, class_validator_1.IsUUID)('4', { message: 'Hostel ID must be a valid UUID' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Hostel ID is required' }),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "hostelId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({}, { message: 'Check-in date must be a valid ISO format (YYYY-MM-DD)' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Check-in date is required' }),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "checkInDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "remarks", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(150, { message: 'Student name must be at most 150 characters' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "studentName", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20, { message: 'Phone number must be at most 20 characters' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsEmail)({}, { message: 'Email must be valid' }),
    (0, class_validator_1.MaxLength)(255, { message: 'Email must be at most 255 characters' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "email", void 0);
