"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscribe.dto.ts
// PURPOSE: Request validation DTO for requesting a subscription plan change.
//          Paid plans are NOT activated immediately: the owner attaches a
//          payment-proof screenshot and an admin reviews the request.
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
exports.SubscribeDto = void 0;
const class_validator_1 = require("class-validator");
const subscription_enum_1 = require("../../enum/subscription.enum");
const payment_proof_enum_1 = require("../../enum/payment-proof.enum");
class SubscribeDto {
}
exports.SubscribeDto = SubscribeDto;
__decorate([
    (0, class_validator_1.IsEnum)(subscription_enum_1.SubscriptionPlan, {
        message: `Plan must be one of: ${Object.values(subscription_enum_1.SubscriptionPlan).join(', ')}`,
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Subscription plan is required' }),
    __metadata("design:type", String)
], SubscribeDto.prototype, "plan", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4', { message: 'Hostel ID must be a valid UUID' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubscribeDto.prototype, "hostelId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(subscription_enum_1.BillingCycle, {
        message: `Billing cycle must be one of: ${Object.values(subscription_enum_1.BillingCycle).join(', ')}`,
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubscribeDto.prototype, "billingCycle", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(payment_proof_enum_1.ProofPaymentMethod, {
        message: `paymentMethod must be one of: ${Object.values(payment_proof_enum_1.ProofPaymentMethod).join(', ')}`,
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubscribeDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100, { message: 'paymentReference cannot exceed 100 characters' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubscribeDto.prototype, "paymentReference", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500, { message: 'proofUrl cannot exceed 500 characters' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubscribeDto.prototype, "proofUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubscribeDto.prototype, "notes", void 0);
