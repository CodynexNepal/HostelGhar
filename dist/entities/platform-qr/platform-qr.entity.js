"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.entity.ts
// PURPOSE: Stores Hostel Ghar PLATFORM payment QRs — the official checkout
//          accounts (eSewa / Khalti / Bank) that hostel owners scan on the
//          Subscription page when they pay for a plan. One row per method.
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
exports.PlatformQr = void 0;
const typeorm_1 = require("typeorm");
const platform_qr_enum_1 = require("../../enum/platform-qr.enum");
let PlatformQr = class PlatformQr {
};
exports.PlatformQr = PlatformQr;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PlatformQr.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: platform_qr_enum_1.PlatformQrMethod,
        enumName: 'platform_qr_method_enum',
        nullable: false,
    }),
    __metadata("design:type", String)
], PlatformQr.prototype, "method", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: false }),
    __metadata("design:type", String)
], PlatformQr.prototype, "qrImageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, default: null }),
    __metadata("design:type", Object)
], PlatformQr.prototype, "qrImagePublicId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: false, default: '' }),
    __metadata("design:type", String)
], PlatformQr.prototype, "label", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], PlatformQr.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], PlatformQr.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], PlatformQr.prototype, "updatedAt", void 0);
exports.PlatformQr = PlatformQr = __decorate([
    (0, typeorm_1.Entity)('platform_qrs'),
    (0, typeorm_1.Unique)('UQ_platform_qrs_method', ['method'])
], PlatformQr);
