"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee.entity.ts
// PURPOSE: Stores monthly hostel fee bills, dues, and payment records per resident.
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
exports.Fee = void 0;
const typeorm_1 = require("typeorm");
const resident_entity_1 = require("../resident/resident.entity");
const hostel_entity_1 = require("../hostel/hostel.entity");
const fee_enum_1 = require("../../enum/fee.enum");
const payment_entity_1 = require("../payment/payment.entity");
let Fee = class Fee {
};
exports.Fee = Fee;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Fee.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], Fee.prototype, "invoiceNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Fee.prototype, "residentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => resident_entity_1.Resident, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'residentId' }),
    __metadata("design:type", resident_entity_1.Resident)
], Fee.prototype, "resident", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Fee.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], Fee.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: fee_enum_1.FeeType, default: fee_enum_1.FeeType.MONTHLY_HOSTEL_FEE }),
    __metadata("design:type", String)
], Fee.prototype, "feeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 10500.0 }),
    __metadata("design:type", Number)
], Fee.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0.0 }),
    __metadata("design:type", Number)
], Fee.prototype, "discountAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0.0 }),
    __metadata("design:type", Number)
], Fee.prototype, "dueAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 10500.0 }),
    __metadata("design:type", Number)
], Fee.prototype, "totalPayable", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0.0 }),
    __metadata("design:type", Number)
], Fee.prototype, "paidAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 10500.0 }),
    __metadata("design:type", Number)
], Fee.prototype, "outstandingAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: false }),
    __metadata("design:type", Number)
], Fee.prototype, "billingMonth", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: false }),
    __metadata("design:type", Number)
], Fee.prototype, "billingYear", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: false }),
    __metadata("design:type", String)
], Fee.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: fee_enum_1.FeeStatus, default: fee_enum_1.FeeStatus.PENDING }),
    __metadata("design:type", String)
], Fee.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => payment_entity_1.Payment, (payment) => payment.fee),
    __metadata("design:type", Array)
], Fee.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Fee.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Fee.prototype, "updatedAt", void 0);
exports.Fee = Fee = __decorate([
    (0, typeorm_1.Entity)('fees'),
    (0, typeorm_1.Index)('idx_fees_resident_status', ['residentId', 'status']),
    (0, typeorm_1.Index)('idx_fees_hostel_month_year', ['hostelId', 'billingMonth', 'billingYear']),
    (0, typeorm_1.Index)('idx_fees_due_date_status', ['dueDate', 'status']),
    (0, typeorm_1.Index)('idx_fees_invoice_number', ['invoiceNumber']),
    (0, typeorm_1.Index)('idx_fees_resident_month_year_type', ['residentId', 'billingMonth', 'billingYear', 'feeType'], { unique: true })
], Fee);
