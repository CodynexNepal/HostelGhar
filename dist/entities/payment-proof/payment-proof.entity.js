"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-proof.entity.ts
// PURPOSE: Stores resident-submitted payment proofs (payment screenshot/receipt)
//          tied to a fee bill. Owners/admins review them before the fee ledger
//          is marked paid.
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
exports.PaymentProof = void 0;
const typeorm_1 = require("typeorm");
const fee_entity_1 = require("../fee/fee.entity");
const hostel_entity_1 = require("../hostel/hostel.entity");
const resident_entity_1 = require("../resident/resident.entity");
const user_entity_1 = require("../user.entity");
const payment_proof_enum_1 = require("../../enum/payment-proof.enum");
let PaymentProof = class PaymentProof {
};
exports.PaymentProof = PaymentProof;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PaymentProof.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], PaymentProof.prototype, "feeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => fee_entity_1.Fee, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'feeId' }),
    __metadata("design:type", fee_entity_1.Fee)
], PaymentProof.prototype, "fee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], PaymentProof.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], PaymentProof.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], PaymentProof.prototype, "residentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => resident_entity_1.Resident, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'residentId' }),
    __metadata("design:type", resident_entity_1.Resident)
], PaymentProof.prototype, "resident", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: false }),
    __metadata("design:type", Number)
], PaymentProof.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: payment_proof_enum_1.ProofPaymentMethod,
        enumName: 'payment_proof_method_enum',
        default: payment_proof_enum_1.ProofPaymentMethod.ESEWA,
    }),
    __metadata("design:type", String)
], PaymentProof.prototype, "method", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentProof.prototype, "transactionRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentProof.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentProof.prototype, "imageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentProof.prototype, "imagePublicId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: payment_proof_enum_1.PaymentProofStatus,
        enumName: 'payment_proof_status_enum',
        default: payment_proof_enum_1.PaymentProofStatus.PENDING,
    }),
    __metadata("design:type", String)
], PaymentProof.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentProof.prototype, "reviewNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentProof.prototype, "reviewedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'reviewedBy' }),
    __metadata("design:type", Object)
], PaymentProof.prototype, "reviewedByUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true, default: null }),
    __metadata("design:type", Object)
], PaymentProof.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], PaymentProof.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], PaymentProof.prototype, "updatedAt", void 0);
exports.PaymentProof = PaymentProof = __decorate([
    (0, typeorm_1.Entity)('payment_proofs'),
    (0, typeorm_1.Index)('idx_payment_proofs_hostel_status', ['hostelId', 'status']),
    (0, typeorm_1.Index)('idx_payment_proofs_resident', ['residentId']),
    (0, typeorm_1.Index)('idx_payment_proofs_fee', ['feeId'])
], PaymentProof);
