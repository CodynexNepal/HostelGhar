// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.repository.ts
// PURPOSE: Data access operations for payments, partial settlements, and audit logs.
// ──────────────────────────────────────────────────────────────────────────────

import { EntityManager, Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Payment } from '../../entities/payment/payment.entity';
import { PaymentMethod, PaymentStatus } from '../../enum/payment.enum';

export interface PaymentListFilters {
  status?: PaymentStatus | undefined;
  paymentMethod?: PaymentMethod | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  search?: string | undefined;
}

export class PaymentRepository {
  private readonly paymentRepo: Repository<Payment>;

  constructor() {
    this.paymentRepo = AppDataSource.getRepository(Payment);
  }

  public async findById(id: string): Promise<Payment | null> {
    return this.paymentRepo.findOne({
      where: { id },
      relations: {
        fee: true,
        resident: { user: true },
        hostel: { owner: true },
        receivedByUser: true,
      },
    });
  }

  public async findByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    return this.paymentRepo.findOne({
      where: { idempotencyKey },
      relations: {
        fee: true,
        resident: { user: true },
      },
    });
  }

  public async findByTransactionReference(
    transactionReference: string,
    invoiceId?: string,
  ): Promise<Payment | null> {
    const where: any = { transactionReference };
    if (invoiceId) {
      where.invoiceId = invoiceId;
    }
    return this.paymentRepo.findOne({
      where,
      relations: {
        fee: true,
        resident: { user: true },
      },
    });
  }

  public async findByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { invoiceId },
      relations: {
        receivedByUser: true,
      },
      order: { paidAt: 'DESC' },
    });
  }

  public async findByResident(
    residentId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<[Payment[], number]> {
    return this.paymentRepo.findAndCount({
      where: { residentId },
      relations: {
        fee: true,
        hostel: true,
      },
      order: { paidAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public async findByHostel(
    hostelId: string,
    page: number = 1,
    limit: number = 20,
    filters: PaymentListFilters = {},
  ): Promise<[Payment[], number]> {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.fee', 'fee')
      .leftJoinAndSelect('p.resident', 'resident')
      .leftJoinAndSelect('resident.user', 'user')
      .leftJoinAndSelect('p.receivedByUser', 'receivedByUser')
      .where('p.hostelId = :hostelId', { hostelId });

    if (filters.status) {
      qb.andWhere('p.paymentStatus = :status', { status: filters.status });
    }

    if (filters.paymentMethod) {
      qb.andWhere('p.paymentMethod = :method', { method: filters.paymentMethod });
    }

    if (filters.startDate) {
      qb.andWhere('p.paidAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      qb.andWhere('p.paidAt <= :endDate', { endDate: filters.endDate });
    }

    if (filters.search?.trim()) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(user.firstName) LIKE :term OR LOWER(user.lastName) LIKE :term OR LOWER(resident.roomNumber) LIKE :term OR LOWER(p.transactionReference) LIKE :term OR LOWER(p.receiptNumber) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('p.paidAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    return qb.getManyAndCount();
  }

  public async createPayment(data: Partial<Payment>, manager?: EntityManager): Promise<Payment> {
    const repo = manager ? manager.getRepository(Payment) : this.paymentRepo;
    const entity = repo.create(data);
    return repo.save(entity);
  }
}
