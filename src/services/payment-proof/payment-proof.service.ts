// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-proof.service.ts
// PURPOSE: Payment proof lifecycle — resident submits a payment screenshot for
//          a fee bill, owner/admin reviews it (approve/reject), listings for
//          both sides. Hostel access is verified exactly like payment QRs.
// ──────────────────────────────────────────────────────────────────────────────

import { STATUS_CODE } from '../../constant/statusCode.interface';
import { IROLES } from '../../enum/roles.enum';
import {
  PaymentProofStatus,
  ProofPaymentMethod,
  ProofReviewAction,
} from '../../enum/payment-proof.enum';
import { PaymentProof } from '../../entities/payment-proof/payment-proof.entity';
import { Fee } from '../../entities/fee/fee.entity';
import { PaymentProofRepository } from '../../repository/payment-proof/payment-proof.repository';
import { CreatePaymentProofDto } from '../../dto/payment-proof/create-payment-proof.dto';
import { ReviewPaymentProofDto } from '../../dto/payment-proof/review-payment-proof.dto';
import { createHttpError } from '../../utils/createHttpError';
import { cacheService } from '../../utils/cache.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { JobType, SocketEvent } from '../../constant/queue.constants';
import {
  createPaginatedResponse,
  PaginatedResponse,
} from '../../utils/pagination.util';
import { imageUploadService } from '../upload/image-upload.service';

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

export interface ListOptions {
  page: number;
  limit: number;
}

/** Shape the dashboard's `normalizeProof()` consumes (see Hostel_Ghar_Dashboard). */
export interface SerializedPaymentProof {
  id: string;
  feeId: string;
  hostelId: string;
  residentId: string;
  residentName: string;
  residentEmail?: string | undefined;
  roomNumber?: string | undefined;
  feeLabel?: string | undefined;
  amount: number;
  method: ProofPaymentMethod;
  transactionRef?: string | undefined;
  remarks?: string | undefined;
  imageUrl: string;
  status: PaymentProofStatus;
  reviewNote?: string | undefined;
  reviewedBy?: string | undefined;
  createdAt: string;
  reviewedAt?: string | undefined;
}

export class PaymentProofService {
  constructor(
    private readonly proofRepository: PaymentProofRepository = new PaymentProofRepository(),
  ) {}

  private serialize(proof: PaymentProof): SerializedPaymentProof {
    const user = proof.resident?.user as { firstName?: string; lastName?: string; email?: string } | undefined;
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
      feeLabel: typeof m === 'number' && typeof y === 'number' ? `${BILLING_MONTHS[m - 1] ?? m} ${y}` : undefined,
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

  private async resolveResident(userId: string, role: string) {
    if (role.toLowerCase() !== IROLES.RESIDENT.toLowerCase()) {
      throw createHttpError(STATUS_CODE.FORBIDDEN, 'Only residents can submit payment proofs');
    }
    const resident = await this.proofRepository.findResidentByUserId(userId);
    if (!resident) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Active resident profile not found');
    return resident;
  }

  private async resolveHostelAccess(actorId: string, role: string, hostelId: string): Promise<void> {
    const normalized = role.toLowerCase();
    if (normalized === IROLES.ADMIN.toLowerCase()) return;
    if (normalized === IROLES.OWNER.toLowerCase()) {
      const hostel = await this.proofRepository.findHostelById(hostelId);
      if (!hostel) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Hostel not found');
      if (hostel.ownerId !== actorId) {
        throw createHttpError(STATUS_CODE.FORBIDDEN, 'You do not manage this hostel');
      }
      return;
    }
    throw createHttpError(STATUS_CODE.FORBIDDEN, 'Only owners or admins can review payment proofs');
  }

  public async submitProof(
    userId: string,
    role: string,
    feeId: string,
    dto: CreatePaymentProofDto,
    file?: Express.Multer.File,
  ): Promise<SerializedPaymentProof> {
    const resident = await this.resolveResident(userId, role);
    const fee: Fee | null = await this.proofRepository.findFeeById(feeId);
    if (!fee) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Fee bill not found');
    if (fee.residentId !== resident.id) {
      throw createHttpError(STATUS_CODE.FORBIDDEN, 'This fee bill does not belong to you');
    }
    const outstanding = Number(fee.totalPayable) - Number(fee.paidAmount);
    const raw = dto.amount !== undefined ? Number(dto.amount) : outstanding;
    const amount = Number.isFinite(raw) && raw > 0 ? raw : outstanding;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Nothing is due on this fee bill');
    }
    const transactionRef = dto.transactionRef?.trim() || dto.transactionId?.trim() || null;
    let imageUrl = dto.imageUrl?.trim() || null;
    let imagePublicId: string | null = null;
    if (file?.buffer) {
      const uploaded = await imageUploadService.uploadPaymentProofScreenshot(file, feeId);
      imageUrl = uploaded.url;
      imagePublicId = uploaded.publicId;
    }
    if (!imageUrl) throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Payment screenshot is required');
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
      status: PaymentProofStatus.PENDING,
    });
    const saved = await this.proofRepository.save(proof);
    const fresh = (await this.proofRepository.findById(saved.id)) ?? saved;
    return this.serialize(fresh);
  }

  public async listForResident(
    userId: string,
    role: string,
    options: ListOptions,
  ): Promise<PaginatedResponse<SerializedPaymentProof>> {
    const resident = await this.resolveResident(userId, role);
    const [rows, total] = await this.proofRepository.findByResident(resident.id, options.page, options.limit);
    return createPaginatedResponse(rows.map((r) => this.serialize(r)), total, options);
  }

  public async listForHostel(
    actorId: string,
    role: string,
    hostelId: string,
    options: ListOptions,
    status?: PaymentProofStatus,
  ): Promise<PaginatedResponse<SerializedPaymentProof>> {
    await this.resolveHostelAccess(actorId, role, hostelId);
    const [rows, total] = await this.proofRepository.findByHostel(hostelId, options.page, options.limit, status);
    return createPaginatedResponse(rows.map((r) => this.serialize(r)), total, options);
  }

  public async listForFee(
    actorId: string,
    role: string,
    feeId: string,
    options: ListOptions,
  ): Promise<PaginatedResponse<SerializedPaymentProof>> {
    const fee = await this.proofRepository.findFeeById(feeId);
    if (!fee) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Fee bill not found');
    if (role.toLowerCase() === IROLES.RESIDENT.toLowerCase()) {
      const resident = await this.proofRepository.findResidentByUserId(actorId);
      if (!resident || fee.residentId !== resident.id) {
        throw createHttpError(STATUS_CODE.FORBIDDEN, 'This fee bill does not belong to you');
      }
    } else {
      await this.resolveHostelAccess(actorId, role, fee.hostelId);
    }
    const [rows, total] = await this.proofRepository.findByFee(feeId, options.page, options.limit);
    return createPaginatedResponse(rows.map((r) => this.serialize(r)), total, options);
  }

  public async reviewProof(
    actorId: string,
    role: string,
    proofId: string,
    dto: ReviewPaymentProofDto,
  ): Promise<SerializedPaymentProof> {
    const proof = await this.proofRepository.findById(proofId);
    if (!proof) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Payment proof not found');
    await this.resolveHostelAccess(actorId, role, proof.hostelId);
    // Idempotent: an APPROVE for an already-APPROVED proof just re-syncs the
    // fee ledger instead of 409ing (dashboards retry; double-clicks happen).
    if (proof.status !== PaymentProofStatus.PENDING) {
      if (proof.status === PaymentProofStatus.APPROVED && dto.action === ProofReviewAction.APPROVE) {
        await this.creditFeeForApprovedProof(proof.id, Number(proof.amount));
        const synced = (await this.proofRepository.findById(proof.id)) ?? proof;
        return this.serialize(synced);
      }
      throw createHttpError(STATUS_CODE.CONFLICT, 'Proof is already reviewed');
    }
    if (dto.action === ProofReviewAction.REJECT) {
      proof.status = PaymentProofStatus.REJECTED;
    } else {
      proof.status = PaymentProofStatus.APPROVED;
      if (dto.amount !== undefined && Number(dto.amount) > 0) proof.amount = Number(dto.amount);
      if (dto.method !== undefined) proof.method = dto.method;
    }
    proof.reviewNote = dto.note?.trim() || null;
    proof.reviewedBy = actorId;
    proof.reviewedAt = new Date();
    const saved = await this.proofRepository.save(proof);

    if (saved.status === PaymentProofStatus.APPROVED) {
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
  private async creditFeeForApprovedProof(proofId: string, amount: number): Promise<void> {
    const fee = await this.proofRepository.applyApprovedProofToFee(proofId, amount);
    if (!fee) return;
    await cacheService.invalidatePattern(`resident:fees`);
    await cacheService.invalidatePattern(`resident:profile`);
    await cacheService.invalidatePattern(`hostel:fees`);
    await cacheService.invalidatePattern(`hostel:residents`);
    await cacheService.invalidatePattern(`owner:dashboard`);
    await cacheService.invalidatePattern(`owner:residents`);
    await eventDispatcher.dispatch({
      type: SocketEvent.PAYMENT_PROCESSED,
      payload: fee,
      userId: fee.resident?.userId,
      hostelId: fee.hostelId,
      metadata: { proofId, feeId: fee.id },
    });
    const email = fee.resident?.user?.email;
    if (email) {
      const name = `${fee.resident?.user?.firstName ?? ''} ${fee.resident?.user?.lastName ?? ''}`.trim() || 'Student';
      await eventDispatcher.queueEmail(JobType.SEND_INVOICE_EMAIL, {
        to: email,
        subject: `Payment approved — fee marked ${fee.status === 'PAID' ? 'PAID' : 'partially paid'}`,
        body:
          `Dear ${name},\n\nYour payment of NPR ${Number(amount).toFixed(2)} has been approved. ` +
          `Fee status is now ${fee.status} (Paid: NPR ${Number(fee.paidAmount).toFixed(2)} of NPR ${Number(fee.totalPayable).toFixed(2)}).\n\nRegards,\nHostelGhar`,
      });
    }
  }
}

export const paymentProofService = new PaymentProofService();
