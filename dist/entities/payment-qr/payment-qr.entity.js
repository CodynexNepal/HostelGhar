"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.entity.ts
// PURPOSE: Stores hostel payment QR codes (eSewa, Khalti, Bank Transfer)
//          shown to residents under My Payments when paying monthly fees.
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
exports.PaymentQr = void 0;
const typeorm_1 = require("typeorm");
const hostel_entity_1 = require("../hostel/hostel.entity");
const payment_qr_enum_1 = require("../../enum/payment-qr.enum");
let PaymentQr = class PaymentQr {
};
exports.PaymentQr = PaymentQr;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PaymentQr.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], PaymentQr.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], PaymentQr.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: payment_qr_enum_1.PaymentMethod, nullable: false }),
    __metadata("design:type", String)
], PaymentQr.prototype, "paymentMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], PaymentQr.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentQr.prototype, "subtitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, nullable: false }),
    __metadata("design:type", String)
], PaymentQr.prototype, "accountName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], PaymentQr.prototype, "accountIdentifier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentQr.prototype, "bankName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentQr.prototype, "displayText", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: false }),
    __metadata("design:type", String)
], PaymentQr.prototype, "qrCodeUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentQr.prototype, "qrCodePublicId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], PaymentQr.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 500,
        nullable: true,
        default: 'Displayed beneath the QR code so residents can verify or copy it',
    }),
    __metadata("design:type", Object)
], PaymentQr.prototype, "instructions", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], PaymentQr.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], PaymentQr.prototype, "updatedAt", void 0);
exports.PaymentQr = PaymentQr = __decorate([
    (0, typeorm_1.Entity)('payment_qrs'),
    (0, typeorm_1.Index)('idx_payment_qrs_hostel_id', ['hostelId']),
    (0, typeorm_1.Index)('idx_payment_qrs_hostel_active', ['hostelId', 'isActive']),
    (0, typeorm_1.Index)('idx_payment_qrs_hostel_method', ['hostelId', 'paymentMethod'])
], PaymentQr);
