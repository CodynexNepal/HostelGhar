"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-room.dto.ts
// PURPOSE: Request validation DTO for Owner creating a Room.
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
exports.CreateRoomDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const room_enum_1 = require("../../enum/room.enum");
const parseAmenities = ({ value }) => {
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed))
                return parsed;
        }
        catch {
            // Comma-separated fallback: "Wifi, Hot Water" -> ["Wifi", "Hot Water"]
            return value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
        }
    }
    return value;
};
class CreateRoomDto {
}
exports.CreateRoomDto = CreateRoomDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Room number is required' }),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "roomNumber", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(room_enum_1.RoomType, { message: 'Type must be one of: SINGLE, DOUBLE, TRIPLE, QUAD, DORMITORY' }),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: 'Capacity must be an integer' }),
    (0, class_validator_1.Min)(1, { message: 'Capacity must be at least 1' }),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateRoomDto.prototype, "capacity", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: 'Monthly rent must be a number' }),
    (0, class_validator_1.IsPositive)({ message: 'Monthly rent must be positive' }),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateRoomDto.prototype, "monthlyRent", void 0);
__decorate([
    (0, class_validator_1.IsArray)({ message: 'Amenities must be an array of strings' }),
    (0, class_validator_1.IsString)({ each: true, message: 'Each amenity must be a string' }),
    (0, class_transformer_1.Transform)(parseAmenities),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateRoomDto.prototype, "amenities", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: 'Floor must be an integer' }),
    (0, class_validator_1.Min)(0, { message: 'Floor cannot be negative' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateRoomDto.prototype, "floor", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(room_enum_1.RoomStatus, {
        message: 'Status must be one of: AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE',
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined && v !== null && v !== ''),
    (0, class_validator_1.IsUUID)('4', { message: 'Hostel ID must be a valid UUID' }),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "hostelId", void 0);
