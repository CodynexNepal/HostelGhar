// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-proof.repository.ts
// PURPOSE: Data access layer for resident payment proofs (TypeORM).
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { PaymentProof } from '../../entities/payment-proof/payment-proof.entity';
import { PaymentProofStatus } from '../../enum/payment-proof.enum';
import { Fee } from '../../entities/fee/fee.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { applyPaymentToFeeAmounts } from '../../utils/fee-credit.util';

/** Relations needed to serialize a proof (resident name, room, bill label). */
const PROOF_RELATIONS = {
  fee: true,
  resident: { user: true },
  reviewedByUser: true,
} as const;

export class PaymentProofRepository {
  private readonly proofRepo: Repository<PaymentProof>;
  private readonly feeRepo: Repository<Fee>;
  private readonly hostelRepo: Repository<Hostel>;
  private readonly residentRepo: Repository<Resident>;

  constructor() {
    this.proofRepo = AppDataSource.getRepository(PaymentProof);
    this.feeRepo = AppDataSource.getRepository(Fee);
    this.hostelRepo = AppDataSource.getRepository(Hostel);
    this.residentRepo = AppDataSource.getRepository(Resident);
  }

  public create(data: Partial<PaymentProof>): PaymentProof {
    return this.proofRepo.create(data);
  }

  public async save(proof: PaymentProof): Promise<PaymentProof> {
    return this.proofRepo.save(proof);
  }

  public async findById(id: string): Promise<PaymentProof | null> {
    return this.proofRepo.findOne({ where: { id }, relations: PROOF_RELATIONS });
  }

  public async findByHostel(
    hostelId: string,
    page: number = 1,
    limit: number = 20,
    status?: PaymentProofStatus,
  ): Promise<[PaymentProof[], number]> {
    return this.proofRepo.findAndCount({
      where: status ? { hostelId, status } : { hostelId },
      relations: PROOF_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public async findByResident(
    residentId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<[PaymentProof[], number]> {
    return this.proofRepo.findAndCount({
      where: { residentId },
      relations: PROOF_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public async findByFee(
    feeId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<[PaymentProof[], number]> {
    return this.proofRepo.findAndCount({
      where: { feeId },
      relations: PROOF_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public async findFeeById(id: string): Promise<Fee | null> {
    return this.feeRepo.findOne({ where: { id }, relations: { resident: { user: true } } });
  }

  /**
   * Credits an APPROVED proof to its fee bill and returns the saved fee.
   * Runs in a transaction so a proof can never be APPROVED while the ledger
   * write fails (that mismatch is exactly "Approved · Paid badge" + "Paid: 0").
   * Idempotent and self-healing — see `applyPaymentToFeeAmounts`.
   */
  public async applyApprovedProofToFee(proofId: string, amount: number): Promise<Fee | null> {
    return AppDataSource.transaction(async (manager) => {
      const proof = await manager.findOne(PaymentProof, { where: { id: proofId } });
      if (!proof) return null;
      const fee = await manager.findOne(Fee, {
        where: { id: proof.feeId },
        relations: { resident: { user: true } },
      });
      if (!fee) return null;

      const result = applyPaymentToFeeAmounts(
        {
          totalPayable: Number(fee.totalPayable),
          paidAmount: Number(fee.paidAmount),
          status: fee.status,
        },
        Number(proof.amount) > 0 ? Number(proof.amount) : Number(amount),
      );

      // Keep the bill's own carried-forward due field in sync so the next
      // billing cycle never re-charges what has just been settled.
      const nextDue = Math.max(result.totalPayable - result.paidAmount, 0);
      if (Number(fee.dueAmount) > 0 && nextDue === 0) fee.dueAmount = 0;

      if (!result.changed) return fee;

      fee.paidAmount = result.paidAmount;
      fee.status = result.status;
      return manager.save(fee);
    });
  }

  public async findHostelById(id: string): Promise<Hostel | null> {
    return this.hostelRepo.findOne({ where: { id } });
  }

  public async findResidentByUserId(userId: string): Promise<Resident | null> {
    return this.residentRepo.findOne({
      where: { userId, isActive: true },
      relations: { user: true },
    });
  }
}
