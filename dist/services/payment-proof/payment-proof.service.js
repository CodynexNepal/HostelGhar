"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-proof.service.ts
// PURPOSE: Payment proof lifecycle — resident submits a payment screenshot for
//          a fee bill, owner/admin reviews it (approve/reject), listings for
//          both sides. Hostel access is verified exactly like payment QRs.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentProofService = exports.PaymentProofService = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const roles_enum_1 = require("../../enum/roles.enum");
const payment_proof_enum_1 = require("../../enum/payment-proof.enum");
const payment_proof_repository_1 = require("../../repository/payment-proof/payment-proof.repository");
const createHttpError_1 = require("../../utils/createHttpError");
const cache_util_1 = require("../../utils/cache.util");
const event_dispatcher_util_1 = require("../../utils/event-dispatcher.util");
const queue_constants_1 = require("../../constant/queue.constants");
const pagination_util_1 = require("../../utils/pagination.util");
const image_upload_service_1 = require("../upload/image-upload.service");
const BILLING_MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
class PaymentProofService {
    constructor(proofRepository = new payment_proof_repository_1.PaymentProofRepository()) {
        this.proofRepository = proofRepository;
    }
    serialize(proof) {
        const user = proof.resident?.user;
        const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Resident';
        const m = proof.fee?.billingMonth;
        const y = proof.fee?.billingYear;
        return {
            id: proof.id,
            feeId: proof.feeId,
            hostelId: proof.hostelId,
            residentId: proof.residentId,
            residentName: name,
            residentEmail: user?.email ?? undefined,
            roomNumber: proof.resident?.roomNumber ?? undefined,
            feeLabel: typeof m === 'number' && typeof y === 'number'
                ? `${BILLING_MONTHS[m - 1] ?? m} ${y}`
                : undefined,
            amount: Number(proof.amount),
            method: proof.method,
            transactionRef: proof.transactionRef ?? undefined,
            remarks: proof.remarks ?? undefined,
            imageUrl: proof.imageUrl ?? '',
            status: proof.status,
            reviewNote: proof.reviewNote ?? undefined,
            reviewedBy: proof.reviewedBy ?? undefined,
            createdAt: proof.createdAt instanceof Date ? proof.createdAt.toISOString() : String(proof.createdAt),
            reviewedAt: proof.reviewedAt instanceof Date ? proof.reviewedAt.toISOString() : undefined,
        };
    }
    async resolveResident(userId, role) {
        if (role.toLowerCase() !== roles_enum_1.IROLES.RESIDENT.toLowerCase()) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'Only residents can submit payment proofs');
        }
        const resident = await this.proofRepository.findResidentByUserId(userId);
        if (!resident)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Active resident profile not found');
        return resident;
    }
    async resolveHostelAccess(actorId, role, hostelId) {
        const normalized = role.toLowerCase();
        if (normalized === roles_enum_1.IROLES.ADMIN.toLowerCase())
            return;
        if (normalized === roles_enum_1.IROLES.OWNER.toLowerCase()) {
            const hostel = await this.proofRepository.findHostelById(hostelId);
            if (!hostel)
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Hostel not found');
            if (hostel.ownerId !== actorId) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'You do not manage this hostel');
            }
            return;
        }
        throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'Only owners or admins can review payment proofs');
    }
    async submitProof(userId, role, feeId, dto, file) {
        const resident = await this.resolveResident(userId, role);
        const fee = await this.proofRepository.findFeeById(feeId);
        if (!fee)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Fee bill not found');
        if (fee.residentId !== resident.id) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'This fee bill does not belong to you');
        }
        const outstanding = Number(fee.totalPayable) - Number(fee.paidAmount);
        const raw = dto.amount !== undefined ? Number(dto.amount) : outstanding;
        const amount = Number.isFinite(raw) && raw > 0 ? raw : outstanding;
        if (!Number.isFinite(amount) || amount <= 0) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Nothing is due on this fee bill');
        }
        const transactionRef = dto.transactionRef?.trim() || dto.transactionId?.trim() || null;
        let imageUrl = dto.imageUrl?.trim() || null;
        let imagePublicId = null;
        if (file?.buffer) {
            const uploaded = await image_upload_service_1.imageUploadService.uploadPaymentProofScreenshot(file, feeId);
            imageUrl = uploaded.url;
            imagePublicId = uploaded.publicId;
        }
        if (!imageUrl)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Payment screenshot is required');
        const proof = this.proofRepository.create({
            feeId: fee.id,
            hostelId: fee.hostelId,
            residentId: resident.id,
            amount,
            method: dto.method,
            transactionRef,
            remarks: dto.remarks?.trim() || null,
            imageUrl,
            imagePublicId,
            status: payment_proof_enum_1.PaymentProofStatus.PENDING,
        });
        const saved = await this.proofRepository.save(proof);
        const fresh = (await this.proofRepository.findById(saved.id)) ?? saved;
        return this.serialize(fresh);
    }
    async listForResident(userId, role, options) {
        const resident = await this.resolveResident(userId, role);
        const [rows, total] = await this.proofRepository.findByResident(resident.id, options.page, options.limit);
        return (0, pagination_util_1.createPaginatedResponse)(rows.map((r) => this.serialize(r)), total, options);
    }
    async listForHostel(actorId, role, hostelId, options, status) {
        await this.resolveHostelAccess(actorId, role, hostelId);
        const [rows, total] = await this.proofRepository.findByHostel(hostelId, options.page, options.limit, status);
        return (0, pagination_util_1.createPaginatedResponse)(rows.map((r) => this.serialize(r)), total, options);
    }
    async listForFee(actorId, role, feeId, options) {
        const fee = await this.proofRepository.findFeeById(feeId);
        if (!fee)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Fee bill not found');
        if (role.toLowerCase() === roles_enum_1.IROLES.RESIDENT.toLowerCase()) {
            const resident = await this.proofRepository.findResidentByUserId(actorId);
            if (!resident || fee.residentId !== resident.id) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'This fee bill does not belong to you');
            }
        }
        else {
            await this.resolveHostelAccess(actorId, role, fee.hostelId);
        }
        const [rows, total] = await this.proofRepository.findByFee(feeId, options.page, options.limit);
        return (0, pagination_util_1.createPaginatedResponse)(rows.map((r) => this.serialize(r)), total, options);
    }
    async reviewProof(actorId, role, proofId, dto) {
        const proof = await this.proofRepository.findById(proofId);
        if (!proof)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Payment proof not found');
        await this.resolveHostelAccess(actorId, role, proof.hostelId);
        // Idempotent: an APPROVE for an already-APPROVED proof just re-syncs the
        // fee ledger instead of 409ing (dashboards retry; double-clicks happen).
        if (proof.status !== payment_proof_enum_1.PaymentProofStatus.PENDING) {
            if (proof.status === payment_proof_enum_1.PaymentProofStatus.APPROVED &&
                dto.action === payment_proof_enum_1.ProofReviewAction.APPROVE) {
                await this.creditFeeForApprovedProof(proof.id, Number(proof.amount));
                const synced = (await this.proofRepository.findById(proof.id)) ?? proof;
                return this.serialize(synced);
            }
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.CONFLICT, 'Proof is already reviewed');
        }
        if (dto.action === payment_proof_enum_1.ProofReviewAction.REJECT) {
            proof.status = payment_proof_enum_1.PaymentProofStatus.REJECTED;
        }
        else {
            proof.status = payment_proof_enum_1.PaymentProofStatus.APPROVED;
            if (dto.amount !== undefined && Number(dto.amount) > 0)
                proof.amount = Number(dto.amount);
            if (dto.method !== undefined)
                proof.method = dto.method;
        }
        proof.reviewNote = dto.note?.trim() || null;
        proof.reviewedBy = actorId;
        proof.reviewedAt = new Date();
        const saved = await this.proofRepository.save(proof);
        if (saved.status === payment_proof_enum_1.PaymentProofStatus.APPROVED) {
            await this.creditFeeForApprovedProof(saved.id, Number(saved.amount));
        }
        const fresh = (await this.proofRepository.findById(saved.id)) ?? saved;
        return this.serialize(fresh);
    }
    /**
     * Credits the fee ledger for an approved proof, busts every cache key the
     * resident/owner dashboards read (fee ledgers + hostel resident rows +
     * owner dashboard), and pushes the live update. Without busting ALL of
     * these, the fee row stays PENDING/Paid:0 or "Current dues" stays stale
     * even though the proof says APPROVED.
     *
     * NOTE on key shapes: keys are `cache:<prefix>:<json|id>` (see
     * `cacheService.generateKey`). `hostel:fees` keys store
     * `{ hostelId, page, limit }` as JSON, so invalidating
     * `hostel:fees:<hostelId>` never matches — the prefix must be used.
     */
    async creditFeeForApprovedProof(proofId, amount) {
        const fee = await this.proofRepository.applyApprovedProofToFee(proofId, amount);
        if (!fee)
            return;
        await cache_util_1.cacheService.invalidatePattern(`resident:fees`);
        await cache_util_1.cacheService.invalidatePattern(`resident:profile`);
        await cache_util_1.cacheService.invalidatePattern(`hostel:fees`);
        await cache_util_1.cacheService.invalidatePattern(`hostel:residents`);
        await cache_util_1.cacheService.invalidatePattern(`owner:dashboard`);
        await cache_util_1.cacheService.invalidatePattern(`owner:residents`);
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.PAYMENT_PROCESSED,
            payload: fee,
            userId: fee.resident?.userId,
            hostelId: fee.hostelId,
            metadata: { proofId, feeId: fee.id },
        });
        const email = fee.resident?.user?.email;
        if (email) {
            const name = `${fee.resident?.user?.firstName ?? ''} ${fee.resident?.user?.lastName ?? ''}`.trim() ||
                'Student';
            await event_dispatcher_util_1.eventDispatcher.queueEmail(queue_constants_1.JobType.SEND_INVOICE_EMAIL, {
                to: email,
                subject: `Payment approved — fee marked ${fee.status === 'PAID' ? 'PAID' : 'partially paid'}`,
                body: `Dear ${name},\n\nYour payment of NPR ${Number(amount).toFixed(2)} has been approved. ` +
                    `Fee status is now ${fee.status} (Paid: NPR ${Number(fee.paidAmount).toFixed(2)} of NPR ${Number(fee.totalPayable).toFixed(2)}).\n\nRegards,\nHostelGhar`,
            });
        }
    }
}
exports.PaymentProofService = PaymentProofService;
exports.paymentProofService = new PaymentProofService();
