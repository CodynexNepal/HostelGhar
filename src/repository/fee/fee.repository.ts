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

  public async findActiveResidents(): Promise<Resident[]> {
    return this.residentRepo.find({
      where: { isActive: true },
      relations: { user: true, hostel: { owner: true } },
    });
  }

  public async findPendingFeesByResident(residentId: string): Promise<Fee[]> {
    // Outstanding = anything not fully PAID (PENDING + PARTIALLY_PAID + OVERDUE).
    // Only querying PENDING drops partial remainders from next month's dueAmount.
    return this.feeRepo.find({
      where: { residentId, status: In([FeeStatus.PENDING, FeeStatus.PARTIALLY_PAID, FeeStatus.OVERDUE]) },
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
