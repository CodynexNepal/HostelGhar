"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-fee-status.dto.ts
// PURPOSE: Validation rules for PATCH /fees/:id/status (owner/admin).
//
// NOTE ON FLEXIBLE CLIENTS: dashboards send the new status under different
// keys (`status` canonical, plus `feeStatus` / `paymentStatus` /
// `payment_status` aliases). All are whitelisted here so `validateDto`
// (whitelist + forbidNonWhitelisted) never 422s with
// "property X should not exist" — the controller normalizes aliases to the
// canonical `status` before calling the service. Same for the optional
// `paidAmount` / `amount` payment aliases.
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
exports.UpdateFeeStatusDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const fee_enum_1 = require("../../enum/fee.enum");
class UpdateFeeStatusDto {
}
exports.UpdateFeeStatusDto = UpdateFeeStatusDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(fee_enum_1.FeeStatus, {
        message: 'status must be one of: PENDING, PAID, OVERDUE, PARTIALLY_PAID',
    }),
    __metadata("design:type", String)
], UpdateFeeStatusDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(fee_enum_1.FeeStatus, {
        message: 'feeStatus must be one of: PENDING, PAID, OVERDUE, PARTIALLY_PAID',
    }),
    __metadata("design:type", String)
], UpdateFeeStatusDto.prototype, "feeStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(fee_enum_1.FeeStatus, {
        message: 'paymentStatus must be one of: PENDING, PAID, OVERDUE, PARTIALLY_PAID',
    }),
    __metadata("design:type", String)
], UpdateFeeStatusDto.prototype, "paymentStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'payment_status must be a string' }),
    __metadata("design:type", String)
], UpdateFeeStatusDto.prototype, "payment_status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'paidAmount must be a number' }),
    (0, class_validator_1.Min)(0.01, { message: 'paidAmount must be a positive number' }),
    __metadata("design:type", Number)
], UpdateFeeStatusDto.prototype, "paidAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'amount must be a number' }),
    (0, class_validator_1.Min)(0.01, { message: 'amount must be a positive number' }),
    __metadata("design:type", Number)
], UpdateFeeStatusDto.prototype, "amount", void 0);
