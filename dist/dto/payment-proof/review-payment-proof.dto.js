"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: review-payment-proof.dto.ts
// PURPOSE: Validation rules for PATCH /payment-proofs/:id/review (owner/admin).
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
exports.ReviewPaymentProofDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const payment_proof_enum_1 = require("../../enum/payment-proof.enum");
class ReviewPaymentProofDto {
}
exports.ReviewPaymentProofDto = ReviewPaymentProofDto;
__decorate([
    (0, class_validator_1.IsEnum)(payment_proof_enum_1.ProofReviewAction, { message: 'action must be one of: APPROVE, REJECT' }),
    __metadata("design:type", String)
], ReviewPaymentProofDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'note must be a string' }),
    (0, class_validator_1.MaxLength)(500, { message: 'note cannot exceed 500 characters' }),
    __metadata("design:type", String)
], ReviewPaymentProofDto.prototype, "note", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({}, { message: 'amount must be a number' }),
    (0, class_validator_1.Min)(0, { message: 'amount must be zero or greater' }),
    __metadata("design:type", Number)
], ReviewPaymentProofDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(payment_proof_enum_1.ProofPaymentMethod, {
        message: 'method must be one of: ESEWA, KHALTI, BANK, CASH',
    }),
    __metadata("design:type", String)
], ReviewPaymentProofDto.prototype, "method", void 0);
