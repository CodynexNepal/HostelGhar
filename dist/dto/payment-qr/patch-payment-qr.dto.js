"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: patch-payment-qr.dto.ts
// PURPOSE: Validation rules for PATCH / partial updates of a payment QR code.
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
exports.PatchPaymentQrDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const payment_qr_enum_1 = require("../../enum/payment-qr.enum");
class PatchPaymentQrDto {
}
exports.PatchPaymentQrDto = PatchPaymentQrDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(payment_qr_enum_1.PaymentMethod, {
        message: 'paymentMethod must be one of: ESEWA, KHALTI, BANK_TRANSFER',
    }),
    __metadata("design:type", String)
], PatchPaymentQrDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'title must be a string' }),
    (0, class_validator_1.MaxLength)(100, { message: 'title cannot exceed 100 characters' }),
    __metadata("design:type", String)
], PatchPaymentQrDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'subtitle must be a string' }),
    (0, class_validator_1.MaxLength)(255, { message: 'subtitle cannot exceed 255 characters' }),
    __metadata("design:type", String)
], PatchPaymentQrDto.prototype, "subtitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'accountName must be a string' }),
    (0, class_validator_1.MaxLength)(150, { message: 'accountName cannot exceed 150 characters' }),
    __metadata("design:type", String)
], PatchPaymentQrDto.prototype, "accountName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'accountIdentifier must be a string' }),
    (0, class_validator_1.MaxLength)(100, { message: 'accountIdentifier cannot exceed 100 characters' }),
    __metadata("design:type", String)
], PatchPaymentQrDto.prototype, "accountIdentifier", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'bankName must be a string' }),
    (0, class_validator_1.MaxLength)(150, { message: 'bankName cannot exceed 150 characters' }),
    __metadata("design:type", String)
], PatchPaymentQrDto.prototype, "bankName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'displayText must be a string' }),
    (0, class_validator_1.MaxLength)(255, { message: 'displayText cannot exceed 255 characters' }),
    __metadata("design:type", String)
], PatchPaymentQrDto.prototype, "displayText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'qrCodeUrl must be a string' }),
    __metadata("design:type", String)
], PatchPaymentQrDto.prototype, "qrCodeUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)({ message: 'isActive must be a boolean' }),
    __metadata("design:type", Boolean)
], PatchPaymentQrDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'instructions must be a string' }),
    (0, class_validator_1.MaxLength)(500, { message: 'instructions cannot exceed 500 characters' }),
    __metadata("design:type", String)
], PatchPaymentQrDto.prototype, "instructions", void 0);
