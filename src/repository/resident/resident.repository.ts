// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident.repository.ts
// PURPOSE: Data access layer for Resident operations on Leaves, Fees, and Profiles.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Resident } from '../../entities/resident/resident.entity';
import { LeaveRequest } from '../../entities/leave/leave-request.entity';
import { LeaveType } from '../../entities/leave/leave-type.entity';
import { Fee } from '../../entities/fee/fee.entity';

export class ResidentRepository {
  private residentRepo: Repository<Resident>;
  private leaveRepo: Repository<LeaveRequest>;
  private leaveTypeRepo: Repository<LeaveType>;
  private feeRepo: Repository<Fee>;

  constructor() {
    this.residentRepo = AppDataSource.getRepository(Resident);
    this.leaveRepo = AppDataSource.getRepository(LeaveRequest);
    this.leaveTypeRepo = AppDataSource.getRepository(LeaveType);
    this.feeRepo = AppDataSource.getRepository(Fee);
  }

  public async findResidentByUserId(userId: string): Promise<Resident | null> {
    return await this.residentRepo.findOne({
      where: { userId, isActive: true },
      relations: { hostel: true, user: true },
    });
  }

  public async saveResident(resident: Resident): Promise<Resident> {
    return await this.residentRepo.save(resident);
  }

  public async findLeaveTypeById(leaveTypeId: string): Promise<LeaveType | null> {
    return await this.leaveTypeRepo.findOne({ where: { id: leaveTypeId } });
  }

  public async createLeaveRequest(data: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const leave = this.leaveRepo.create(data);
    return await this.leaveRepo.save(leave);
  }

  public async findLeavesByResident(
    residentId: string,
    page: number,
    limit: number,
  ): Promise<[LeaveRequest[], number]> {
    return await this.leaveRepo.findAndCount({
      where: { residentId },
      relations: { leaveType: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public async findFeesByResident(residentId: string): Promise<Fee[]> {
    return await this.feeRepo.find({
      where: { residentId },
      order: { billingYear: 'DESC', billingMonth: 'DESC' },
    });
  }
}
