"use strict";
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
exports.CreateBedDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const bed_enum_1 = require("../../enum/bed.enum");
class CreateBedDto {
}
exports.CreateBedDto = CreateBedDto;
__decorate([
    (0, class_validator_1.IsUUID)('4', { message: 'Hostel ID must be a valid UUID' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Hostel ID is required' }),
    __metadata("design:type", String)
], CreateBedDto.prototype, "hostelId", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'Room number must be a string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Room number is required' }),
    (0, class_validator_1.MaxLength)(20, { message: 'Room number cannot exceed 20 characters' }),
    __metadata("design:type", String)
], CreateBedDto.prototype, "roomNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'Bed number must be a string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Bed number is required' }),
    (0, class_validator_1.MaxLength)(20, { message: 'Bed number cannot exceed 20 characters' }),
    __metadata("design:type", String)
], CreateBedDto.prototype, "bedNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(bed_enum_1.BedStatus, {
        message: 'Status must be one of: AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE',
    }),
    __metadata("design:type", String)
], CreateBedDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'Rent amount must be a number' }),
    (0, class_validator_1.Min)(0, { message: 'Rent amount cannot be negative' }),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateBedDto.prototype, "rentAmount", void 0);
