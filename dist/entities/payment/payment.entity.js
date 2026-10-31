"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.entity.ts
// PURPOSE: Stores successful and processed payment transactions (cash, digital,
//          partial, full) associated with monthly fees/invoices.
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
exports.Payment = void 0;
const typeorm_1 = require("typeorm");
const fee_entity_1 = require("../fee/fee.entity");
const resident_entity_1 = require("../resident/resident.entity");
const hostel_entity_1 = require("../hostel/hostel.entity");
const user_entity_1 = require("../user.entity");
const payment_enum_1 = require("../../enum/payment.enum");
let Payment = class Payment {
};
exports.Payment = Payment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Payment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Payment.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => fee_entity_1.Fee, (fee) => fee.payments, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'invoiceId' }),
    __metadata("design:type", fee_entity_1.Fee)
], Payment.prototype, "fee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Payment.prototype, "residentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => resident_entity_1.Resident, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'residentId' }),
    __metadata("design:type", resident_entity_1.Resident)
], Payment.prototype, "resident", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Payment.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], Payment.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: false }),
    __metadata("design:type", Number)
], Payment.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: payment_enum_1.PaymentMethod,
        enumName: 'payment_method_enum',
        default: payment_enum_1.PaymentMethod.CASH,
    }),
    __metadata("design:type", String)
], Payment.prototype, "paymentMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: payment_enum_1.PaymentStatus,
        enumName: 'payment_status_enum',
        default: payment_enum_1.PaymentStatus.SUCCESS,
    }),
    __metadata("design:type", String)
], Payment.prototype, "paymentStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], Payment.prototype, "transactionReference", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, nullable: true, unique: true }),
    __metadata("design:type", Object)
], Payment.prototype, "idempotencyKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], Payment.prototype, "receiptNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Payment.prototype, "receivedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'receivedBy' }),
    __metadata("design:type", Object)
], Payment.prototype, "receivedByUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], Payment.prototype, "paidAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Payment.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Payment.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Payment.prototype, "updatedAt", void 0);
exports.Payment = Payment = __decorate([
    (0, typeorm_1.Entity)('payments'),
    (0, typeorm_1.Index)('idx_payments_invoice', ['invoiceId']),
    (0, typeorm_1.Index)('idx_payments_resident', ['residentId']),
    (0, typeorm_1.Index)('idx_payments_hostel_paid_at', ['hostelId', 'paidAt']),
    (0, typeorm_1.Index)('idx_payments_transaction_ref', ['transactionReference']),
    (0, typeorm_1.Index)('idx_payments_idempotency_key', ['idempotencyKey'], { unique: true })
], Payment);
