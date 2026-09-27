// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.repository.ts
// PURPOSE: Data access layer for Hostel Payment QR Codes (TypeORM).
// ──────────────────────────────────────────────────────────────────────────────

import { DeleteResult, Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { PaymentQr } from '../../entities/payment-qr/payment-qr.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { PaymentMethod } from '../../enum/payment-qr.enum';

export class PaymentQrRepository {
  private readonly qrRepo: Repository<PaymentQr>;
  private readonly hostelRepo: Repository<Hostel>;
  private readonly residentRepo: Repository<Resident>;

  constructor() {
    this.qrRepo = AppDataSource.getRepository(PaymentQr);
    this.hostelRepo = AppDataSource.getRepository(Hostel);
    this.residentRepo = AppDataSource.getRepository(Resident);
  }

  public create(data: Partial<PaymentQr>): PaymentQr {
    return this.qrRepo.create(data);
  }

  public async save(paymentQr: PaymentQr): Promise<PaymentQr> {
    return this.qrRepo.save(paymentQr);
  }

  public async findById(id: string): Promise<PaymentQr | null> {
    return this.qrRepo.findOne({
      where: { id },
      relations: { hostel: true },
    });
  }

  public async findByHostel(
    hostelId: string,
    options?: { onlyActive?: boolean },
  ): Promise<PaymentQr[]> {
    return this.qrRepo.find({
      where: {
        hostelId,
        ...(options?.onlyActive !== undefined ? { isActive: options.onlyActive } : {}),
      },
      order: {
        paymentMethod: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  public async findByHostelAndMethod(
    hostelId: string,
    paymentMethod: PaymentMethod,
  ): Promise<PaymentQr | null> {
    return this.qrRepo.findOne({
      where: {
        hostelId,
        paymentMethod,
      },
    });
  }

  public async delete(id: string): Promise<DeleteResult> {
    return this.qrRepo.delete(id);
  }

  public async findHostelById(hostelId: string): Promise<Hostel | null> {
    return this.hostelRepo.findOne({
      where: { id: hostelId },
    });
  }

  public async findHostelsByOwner(ownerId: string): Promise<Hostel[]> {
    return this.hostelRepo.find({
      where: { ownerId },
      order: { name: 'ASC' },
    });
  }

  public async findResidentByUserId(userId: string): Promise<Resident | null> {
    return this.residentRepo.findOne({
      where: { userId, isActive: true },
      relations: { hostel: true },
    });
  }
}
