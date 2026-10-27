"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-payment-proof.dto.ts
// PURPOSE: Validation rules for POST /fees/:feeId/payment-proofs.
//
// NOTE ON FLEXIBLE CLIENTS: the dashboard posts EITHER multipart/form-data
// (screenshot/receipt file + text parts) OR plain JSON (imageUrl). Text parts
// arrive as strings, so `@Type(() => Number)` coerces `amount`. Aliases some
// clients send (`transactionId`) are accepted here and normalized in the
// service — anything NOT declared here is rejected by `forbidNonWhitelisted`.
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
exports.CreatePaymentProofDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const payment_proof_enum_1 = require("../../enum/payment-proof.enum");
class CreatePaymentProofDto {
}
exports.CreatePaymentProofDto = CreatePaymentProofDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'amount must be a number' }),
    (0, class_validator_1.Min)(0, { message: 'amount must be zero or greater' }),
    __metadata("design:type", Number)
], CreatePaymentProofDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(payment_proof_enum_1.ProofPaymentMethod, {
        message: 'method must be one of: ESEWA, KHALTI, BANK, CASH',
    }),
    __metadata("design:type", String)
], CreatePaymentProofDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'transactionRef must be a string' }),
    (0, class_validator_1.MaxLength)(100, { message: 'transactionRef cannot exceed 100 characters' }),
    __metadata("design:type", String)
], CreatePaymentProofDto.prototype, "transactionRef", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'transactionId must be a string' }),
    (0, class_validator_1.MaxLength)(100, { message: 'transactionId cannot exceed 100 characters' }),
    __metadata("design:type", String)
], CreatePaymentProofDto.prototype, "transactionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'remarks must be a string' }),
    (0, class_validator_1.MaxLength)(500, { message: 'remarks cannot exceed 500 characters' }),
    __metadata("design:type", String)
], CreatePaymentProofDto.prototype, "remarks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'imageUrl must be a string' }),
    __metadata("design:type", String)
], CreatePaymentProofDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'hostelId must be a string' }),
    (0, class_validator_1.MaxLength)(64, { message: 'hostelId is not a valid identifier' }),
    __metadata("design:type", String)
], CreatePaymentProofDto.prototype, "hostelId", void 0);
