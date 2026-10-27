"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-proof.repository.ts
// PURPOSE: Data access layer for resident payment proofs (TypeORM).
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentProofRepository = void 0;
const database_source_1 = require("../../database/database-source");
const payment_proof_entity_1 = require("../../entities/payment-proof/payment-proof.entity");
const fee_entity_1 = require("../../entities/fee/fee.entity");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const fee_credit_util_1 = require("../../utils/fee-credit.util");
/** Relations needed to serialize a proof (resident name, room, bill label). */
const PROOF_RELATIONS = {
    fee: true,
    resident: { user: true },
    reviewedByUser: true,
};
class PaymentProofRepository {
    constructor() {
        this.proofRepo = database_source_1.AppDataSource.getRepository(payment_proof_entity_1.PaymentProof);
        this.feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
        this.hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        this.residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
    }
    create(data) {
        return this.proofRepo.create(data);
    }
    async save(proof) {
        return this.proofRepo.save(proof);
    }
    async findById(id) {
        return this.proofRepo.findOne({ where: { id }, relations: PROOF_RELATIONS });
    }
    async findByHostel(hostelId, page = 1, limit = 20, status) {
        return this.proofRepo.findAndCount({
            where: status ? { hostelId, status } : { hostelId },
            relations: PROOF_RELATIONS,
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
    async findByResident(residentId, page = 1, limit = 20) {
        return this.proofRepo.findAndCount({
            where: { residentId },
            relations: PROOF_RELATIONS,
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
    async findByFee(feeId, page = 1, limit = 20) {
        return this.proofRepo.findAndCount({
            where: { feeId },
            relations: PROOF_RELATIONS,
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
    async findFeeById(id) {
        return this.feeRepo.findOne({ where: { id }, relations: { resident: { user: true } } });
    }
    /**
     * Credits an APPROVED proof to its fee bill and returns the saved fee.
     * Runs in a transaction so a proof can never be APPROVED while the ledger
     * write fails (that mismatch is exactly "Approved · Paid badge" + "Paid: 0").
     * Idempotent and self-healing — see `applyPaymentToFeeAmounts`.
     */
    async applyApprovedProofToFee(proofId, amount) {
        return database_source_1.AppDataSource.transaction(async (manager) => {
            const proof = await manager.findOne(payment_proof_entity_1.PaymentProof, { where: { id: proofId } });
            if (!proof)
                return null;
            const fee = await manager.findOne(fee_entity_1.Fee, {
                where: { id: proof.feeId },
                relations: { resident: { user: true } },
            });
            if (!fee)
                return null;
            const result = (0, fee_credit_util_1.applyPaymentToFeeAmounts)({
                totalPayable: Number(fee.totalPayable),
                paidAmount: Number(fee.paidAmount),
                status: fee.status,
            }, Number(proof.amount) > 0 ? Number(proof.amount) : Number(amount));
            // Keep the bill's own carried-forward due field in sync so the next
            // billing cycle never re-charges what has just been settled.
            const nextDue = Math.max(result.totalPayable - result.paidAmount, 0);
            if (Number(fee.dueAmount) > 0 && nextDue === 0)
                fee.dueAmount = 0;
            if (!result.changed)
                return fee;
            fee.paidAmount = result.paidAmount;
            fee.status = result.status;
            return manager.save(fee);
        });
    }
    async findHostelById(id) {
        return this.hostelRepo.findOne({ where: { id } });
    }
    async findResidentByUserId(userId) {
        return this.residentRepo.findOne({
            where: { userId, isActive: true },
            relations: { user: true },
        });
    }
}
exports.PaymentProofRepository = PaymentProofRepository;
