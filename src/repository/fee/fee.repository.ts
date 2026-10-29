import { In, Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Fee } from '../../entities/fee/fee.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { FeeStatus, FeeType } from '../../enum/fee.enum';

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
    // Outstanding = anything not fully PAID (PENDING + PARTIALLY_PAID + OVERDUE).
    // Only querying PENDING drops partial remainders from next month's dueAmount.
    return this.feeRepo.find({
      where: {
        residentId,
        status: In([FeeStatus.PENDING, FeeStatus.PARTIALLY_PAID, FeeStatus.OVERDUE]),
      },
    });
  }

  public async findMonthlyFee(
    residentId: string,
    billingMonth: number,
    billingYear: number,
  ): Promise<Fee | null> {
    return this.feeRepo.findOne({
      where: { residentId, billingMonth, billingYear, feeType: FeeType.MONTHLY_HOSTEL_FEE },
    });
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
      select: ['id', 'residentId', 'billingMonth', 'billingYear', 'totalPayable'],
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
      .addSelect('SUM(fee.totalPayable - fee.paidAmount)', 'outstandingDue')
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
    const entities = this.feeRepo.create(feesData);
    return this.feeRepo.save(entities, { chunk: 100 });
  }

  public async createFee(data: Partial<Fee>): Promise<Fee> {
    const fee = this.feeRepo.create(data);
    return this.feeRepo.save(fee);
  }

  public async saveFee(fee: Fee): Promise<Fee> {
    return this.feeRepo.save(fee);
  }

  public async findById(id: string): Promise<Fee | null> {
    return this.feeRepo.findOne({
      where: { id },
      relations: { resident: { user: true }, hostel: true },
    });
  }

  public async findByHostel(
    hostelId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<[Fee[], number]> {
    return this.feeRepo.findAndCount({
      where: { hostelId },
      relations: { resident: { user: true } },
      order: { billingYear: 'DESC', billingMonth: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
