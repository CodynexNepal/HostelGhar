// ─────────────────────────────────────────────────────────────
// FILE: report.repository.ts
// PURPOSE: Owner-scoped data access for Reports (rooms/beds/fees/proofs).
//          TypeORM stays here; grouping/exports live in the service.
// ─────────────────────────────────────────────────────────────
import { In, Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Room } from '../../entities/room/room.entity';
import { Bed } from '../../entities/bed/bed.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { Fee } from '../../entities/fee/fee.entity';
import { PaymentProof } from '../../entities/payment-proof/payment-proof.entity';
import { PaymentProofStatus } from '../../enum/payment-proof.enum';
import { FeeStatus } from '../../enum/fee.enum';

export class ReportRepository {
  private hostelRepo: Repository<Hostel>;
  private roomRepo: Repository<Room>;
  private bedRepo: Repository<Bed>;
  private residentRepo: Repository<Resident>;
  private feeRepo: Repository<Fee>;
  private proofRepo: Repository<PaymentProof>;

  constructor() {
    this.hostelRepo = AppDataSource.getRepository(Hostel);
    this.roomRepo = AppDataSource.getRepository(Room);
    this.bedRepo = AppDataSource.getRepository(Bed);
    this.residentRepo = AppDataSource.getRepository(Resident);
    this.feeRepo = AppDataSource.getRepository(Fee);
    this.proofRepo = AppDataSource.getRepository(PaymentProof);
  }

  /** Hostels visible to the requester. Owners: only theirs. Admins: all. */
  public async findScopedHostels(
    requester: { userId: string; role: string },
    hostelId?: string,
  ): Promise<Hostel[]> {
    const isAdmin = requester.role === 'admin';
    if (hostelId) {
      const hostel = await this.hostelRepo.findOne({ where: { id: hostelId } });
      if (!hostel) return [];
      if (!isAdmin && hostel.ownerId !== requester.userId) return [];
      return [hostel];
    }
    if (isAdmin) {
      return this.hostelRepo.find({ order: { name: 'ASC' } });
    }
    return this.hostelRepo.find({
      where: { ownerId: requester.userId },
      order: { name: 'ASC' },
    });
  }

  public async findRoomsByHostels(hostelIds: string[]): Promise<Room[]> {
    if (hostelIds.length === 0) return [];
    return this.roomRepo.find({
      where: { hostelId: In(hostelIds) },
      relations: { hostel: true },
      order: { roomNumber: 'ASC' },
    });
  }

  public async findBedsByHostels(hostelIds: string[]): Promise<Bed[]> {
    if (hostelIds.length === 0) return [];
    return this.bedRepo.find({
      where: { hostelId: In(hostelIds) },
      relations: { room: true },
      order: { bedNumber: 'ASC' },
    });
  }

  public async findResidentsByHostels(hostelIds: string[]): Promise<Resident[]> {
    if (hostelIds.length === 0) return [];
    return this.residentRepo.find({
      where: { hostelId: In(hostelIds), isActive: true },
      relations: { user: true, hostel: true },
      order: { roomNumber: 'ASC' },
    });
  }

  public async findFeesByHostels(hostelIds: string[]): Promise<Fee[]> {
    if (hostelIds.length === 0) return [];
    return this.feeRepo.find({
      where: { hostelId: In(hostelIds) },
      relations: { resident: { user: true }, hostel: true },
      order: { billingYear: 'DESC', billingMonth: 'DESC' },
    });
  }

  public async findOutstandingFeesByHostels(hostelIds: string[]): Promise<Fee[]> {
    if (hostelIds.length === 0) return [];
    return this.feeRepo.find({
      where: {
        hostelId: In(hostelIds),
        status: In([FeeStatus.PENDING, FeeStatus.OVERDUE, FeeStatus.PARTIALLY_PAID]),
      },
      relations: { resident: { user: true }, hostel: true },
      order: { dueDate: 'ASC' },
    });
  }

  public async findApprovedProofsByHostels(hostelIds: string[]): Promise<PaymentProof[]> {
    if (hostelIds.length === 0) return [];
    return this.proofRepo.find({
      where: { hostelId: In(hostelIds), status: PaymentProofStatus.APPROVED },
      relations: { resident: { user: true }, fee: true, hostel: true },
      order: { createdAt: 'ASC' },
    });
  }
}
