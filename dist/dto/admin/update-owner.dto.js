"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-owner.dto.ts
// PURPOSE: Request validation DTO for updating an existing hostel owner.
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
exports.UpdateOwnerDto = void 0;
const class_validator_1 = require("class-validator");
const subscription_enum_1 = require("../../enum/subscription.enum");
class UpdateOwnerDto {
}
exports.UpdateOwnerDto = UpdateOwnerDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2, { message: 'Owner name must be at least 2 characters' }),
    (0, class_validator_1.MaxLength)(100, { message: 'Owner name cannot exceed 100 characters' }),
    __metadata("design:type", String)
], UpdateOwnerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)({}, { message: 'A valid email is required' }),
    __metadata("design:type", String)
], UpdateOwnerDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20, { message: 'Phone number cannot exceed 20 characters' }),
    __metadata("design:type", String)
], UpdateOwnerDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(subscription_enum_1.SubscriptionPlan, { message: 'Invalid subscription plan' }),
    __metadata("design:type", String)
], UpdateOwnerDto.prototype, "plan", void 0);
