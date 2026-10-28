"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: location.dto.ts
// PURPOSE: Validation DTOs for hostel geographic location and sharing state.
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
exports.UpdateHostelLocationDto = void 0;
const class_validator_1 = require("class-validator");
class UpdateHostelLocationDto {
}
exports.UpdateHostelLocationDto = UpdateHostelLocationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'latitude must be a valid number' }),
    (0, class_validator_1.Min)(-90, { message: 'latitude must be >= -90' }),
    (0, class_validator_1.Max)(90, { message: 'latitude must be <= 90' }),
    __metadata("design:type", Object)
], UpdateHostelLocationDto.prototype, "latitude", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'longitude must be a valid number' }),
    (0, class_validator_1.Min)(-180, { message: 'longitude must be >= -180' }),
    (0, class_validator_1.Max)(180, { message: 'longitude must be <= 180' }),
    __metadata("design:type", Object)
], UpdateHostelLocationDto.prototype, "longitude", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)({ message: 'isLocationShared must be a boolean' }),
    __metadata("design:type", Boolean)
], UpdateHostelLocationDto.prototype, "isLocationShared", void 0);
