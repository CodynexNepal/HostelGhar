"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-platform-qr.dto.ts
// PURPOSE: Validation rules for POST /admin/platform-qrs — upload a platform
//          checkout QR. Accepts a multipart file (`qrImage`) OR a JSON body
//          with `qrImageUrl`. The dashboard sends both shapes.
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
exports.CreatePlatformQrDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const platform_qr_enum_1 = require("../../enum/platform-qr.enum");
class CreatePlatformQrDto {
}
exports.CreatePlatformQrDto = CreatePlatformQrDto;
__decorate([
    (0, class_validator_1.IsEnum)(platform_qr_enum_1.PlatformQrMethod, {
        message: 'method must be one of: ESEWA, KHALTI, BANK',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'method is required' }),
    __metadata("design:type", String)
], CreatePlatformQrDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'label must be a string' }),
    (0, class_validator_1.MaxLength)(255, { message: 'label cannot exceed 255 characters' }),
    __metadata("design:type", String)
], CreatePlatformQrDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'qrImageUrl must be a string' }),
    __metadata("design:type", String)
], CreatePlatformQrDto.prototype, "qrImageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)({ message: 'isActive must be a boolean' }),
    __metadata("design:type", Boolean)
], CreatePlatformQrDto.prototype, "isActive", void 0);
