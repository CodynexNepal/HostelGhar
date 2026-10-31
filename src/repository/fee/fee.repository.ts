import { In, Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Fee } from '../../entities/fee/fee.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { FeeStatus, FeeType } from '../../enum/fee.enum';
import {
  calculatePaymentStatus,
  feeOutstandingAmount,
  roundMoney,
} from '../../utils/fee-credit.util';

export interface HostelFeeFilters {
  status?: string;
  billingMonth?: number;
  billingYear?: number;
  search?: string;
}

export const generateInvoiceNumber = (month: number, year: number): string => {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `INV-${year}${String(month).padStart(2, '0')}-${rand}`;
};

export class FeeRepository {
  private readonly feeRepo: Repository<Fee>;
  private readonly residentRepo: Repository<Resident>;

  constructor() {
    this.feeRepo = AppDataSource.getRepository(Fee);
    this.residentRepo = AppDataSource.getRepository(Resident);
  }

  public async findActiveResidents(hostelId?: string): Promise<Resident[]> {
    const where: any = { isActive: true };
    if (hostelId) {
      where.hostelId = hostelId;
    }
    return this.residentRepo.find({
      where,
      relations: { user: true, hostel: { owner: true } },
    });
  }

  public async findPendingFeesByResident(residentId: string): Promise<Fee[]> {
    const fees = await this.feeRepo.find({
      where: {
        residentId,
        status: In([FeeStatus.PENDING, FeeStatus.PARTIALLY_PAID, FeeStatus.OVERDUE]),
      },
    });

    return fees.map((fee) => {
      fee.outstandingAmount = feeOutstandingAmount(fee);
      fee.status = calculatePaymentStatus(fee);
      return fee;
    });
  }

  public async findMonthlyFee(
    residentId: string,
    billingMonth: number,
    billingYear: number,
  ): Promise<Fee | null> {
    const fee = await this.feeRepo.findOne({
      where: { residentId, billingMonth, billingYear, feeType: FeeType.MONTHLY_HOSTEL_FEE },
      relations: { payments: true },
    });
    if (fee) {
      fee.outstandingAmount = feeOutstandingAmount(fee);
      fee.status = calculatePaymentStatus(fee);
    }
    return fee;
  }

  /**
   * Batch lookup of existing monthly fees for a list of residents in one query.
   * Eliminates N individual queries during monthly fee automation.
   */
  public async findExistingMonthlyFees(
    residentIds: string[],
    billingMonth: number,
    billingYear: number,
  ): Promise<Fee[]> {
    if (residentIds.length === 0) return [];
    return this.feeRepo.find({
      where: {
        residentId: In(residentIds),
        billingMonth,
        billingYear,
        feeType: FeeType.MONTHLY_HOSTEL_FEE,
      },
      select: [
        'id',
        'residentId',
        'billingMonth',
        'billingYear',
        'totalPayable',
        'amount',
        'discountAmount',
        'outstandingAmount',
        'paidAmount',
        'dueAmount',
        'dueDate',
        'invoiceNumber',
        'status',
      ],
    });
  }

  /**
   * Batch aggregate query to calculate outstanding pending/unpaid balances for all residents in ONE query.
   * Eliminates N individual pending fee queries during monthly fee generation.
   */
  public async findPendingBalancesByResidents(residentIds: string[]): Promise<Map<string, number>> {
    const balances = new Map<string, number>();
    if (residentIds.length === 0) return balances;

    const rawTotals = await this.feeRepo
      .createQueryBuilder('fee')
      .select('fee.residentId', 'residentId')
      .addSelect(
        'SUM(GREATEST(0, fee.totalPayable - fee.discountAmount - fee.paidAmount))',
        'outstandingDue',
      )
      .where('fee.residentId IN (:...residentIds)', { residentIds })
      .andWhere('fee.status IN (:...statuses)', {
        statuses: [FeeStatus.PENDING, FeeStatus.PARTIALLY_PAID, FeeStatus.OVERDUE],
      })
      .groupBy('fee.residentId')
      .getRawMany<{ residentId: string; outstandingDue: string | number }>();

    for (const row of rawTotals) {
      balances.set(row.residentId, Math.max(0, Number(row.outstandingDue) || 0));
    }
    return balances;
  }

  /**
   * Bulk persists fee records in a single transactional chunk.
   */
  public async createFeesBulk(feesData: Partial<Fee>[]): Promise<Fee[]> {
    if (feesData.length === 0) return [];
    const withInvoices = feesData.map((f) => {
      const month = f.billingMonth ?? 1;
      const year = f.billingYear ?? new Date().getFullYear();
      const invoiceNumber = f.invoiceNumber || generateInvoiceNumber(month, year);
      const totalPayable = roundMoney(f.totalPayable ?? 10500);
      const discountAmount = roundMoney(f.discountAmount ?? 0);
      const paidAmount = roundMoney(f.paidAmount ?? 0);
      const outstandingAmount = roundMoney(Math.max(0, totalPayable - discountAmount - paidAmount));
      return {
        ...f,
        invoiceNumber,
        totalPayable,
        discountAmount,
        paidAmount,
        outstandingAmount,
      };
    });
    const entities = this.feeRepo.create(withInvoices);
    return this.feeRepo.save(entities, { chunk: 100 });
  }

  public async createFee(data: Partial<Fee>): Promise<Fee> {
    const month = data.billingMonth ?? 1;
    const year = data.billingYear ?? new Date().getFullYear();
    const invoiceNumber = data.invoiceNumber || generateInvoiceNumber(month, year);
    const totalPayable = roundMoney(data.totalPayable ?? 10500);
    const discountAmount = roundMoney(data.discountAmount ?? 0);
    const paidAmount = roundMoney(data.paidAmount ?? 0);
    const outstandingAmount = roundMoney(Math.max(0, totalPayable - discountAmount - paidAmount));
    const fee = this.feeRepo.create({
      ...data,
      invoiceNumber,
      totalPayable,
      discountAmount,
      paidAmount,
      outstandingAmount,
    });
    return this.feeRepo.save(fee);
  }

  public async saveFee(fee: Fee): Promise<Fee> {
    return this.feeRepo.save(fee);
  }

  public async findById(id: string): Promise<Fee | null> {
    const fee = await this.feeRepo.findOne({
      where: { id },
      relations: {
        resident: { user: true },
        hostel: { owner: true },
        payments: { receivedByUser: true },
      },
    });
    if (fee) {
      fee.outstandingAmount = feeOutstandingAmount(fee);
      fee.status = calculatePaymentStatus(fee);
    }
    return fee;
  }

  public async findByHostel(
    hostelId: string,
    page: number = 1,
    limit: number = 20,
    filters: HostelFeeFilters = {},
  ): Promise<[Fee[], number]> {
    const qb = this.feeRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.resident', 'resident')
      .leftJoinAndSelect('resident.user', 'user')
      .leftJoinAndSelect('f.payments', 'payments')
      .where('f.hostelId = :hostelId', { hostelId });

    if (filters.billingMonth) {
      qb.andWhere('f.billingMonth = :month', { month: filters.billingMonth });
    }

    if (filters.billingYear) {
      qb.andWhere('f.billingYear = :year', { year: filters.billingYear });
    }

    if (filters.status) {
      const normalizedStatus = filters.status.toUpperCase().trim();
      if (normalizedStatus === 'PARTIAL') {
        qb.andWhere('f.status = :status', { status: FeeStatus.PARTIALLY_PAID });
      } else if (normalizedStatus === FeeStatus.OVERDUE) {
        // Outstanding > 0 and (status is OVERDUE OR dueDate < today)
        qb.andWhere('GREATEST(0, f.totalPayable - f.discountAmount - f.paidAmount) > 0').andWhere(
          '(f.status = :overdueStatus OR f.dueDate < CURRENT_DATE)',
          {
            overdueStatus: FeeStatus.OVERDUE,
          },
        );
      } else if (Object.values(FeeStatus).includes(normalizedStatus as FeeStatus)) {
        qb.andWhere('f.status = :status', { status: normalizedStatus });
      }
    }

    if (filters.search?.trim()) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(user.firstName) LIKE :term OR LOWER(user.lastName) LIKE :term OR LOWER(resident.roomNumber) LIKE :term OR LOWER(f.invoiceNumber) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('f.billingYear', 'DESC')
      .addOrderBy('f.billingMonth', 'DESC')
      .addOrderBy('f.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [fees, total] = await qb.getManyAndCount();

    const normalizedFees = fees.map((f) => {
      f.outstandingAmount = feeOutstandingAmount(f);
      f.status = calculatePaymentStatus(f);
      return f;
    });

    return [normalizedFees, total];
  }
}
