"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: review-subscription.dto.ts
// PURPOSE: Admin-only DTO for approving or rejecting a PENDING subscription
//          request (the owner's uploaded payment proof).
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
exports.ReviewSubscriptionDto = void 0;
const class_validator_1 = require("class-validator");
const subscription_enum_1 = require("../../enum/subscription.enum");
class ReviewSubscriptionDto {
}
exports.ReviewSubscriptionDto = ReviewSubscriptionDto;
__decorate([
    (0, class_validator_1.IsEnum)(subscription_enum_1.SubscriptionReviewAction, {
        message: `action must be one of: ${Object.values(subscription_enum_1.SubscriptionReviewAction).join(', ')}`,
    }),
    __metadata("design:type", String)
], ReviewSubscriptionDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500, { message: 'note cannot exceed 500 characters' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReviewSubscriptionDto.prototype, "note", void 0);
