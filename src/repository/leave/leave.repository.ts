import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { LeaveRequest } from '../../entities/leave/leave-request.entity';
import { LeaveStatus } from '../../enum/leave.enum';

export class LeaveRepository {
  private readonly leaveRepo: Repository<LeaveRequest>;

  constructor() {
    this.leaveRepo = AppDataSource.getRepository(LeaveRequest);
  }

  public async findByHostel(
    hostelId: string,
    status?: LeaveStatus,
    page: number = 1,
    limit: number = 20,
  ): Promise<[LeaveRequest[], number]> {
    return this.leaveRepo.findAndCount({
      where: {
        resident: { hostelId },
        ...(status ? { status } : {}),
      },
      relations: { resident: { user: true }, leaveType: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public async findById(id: string): Promise<LeaveRequest | null> {
    return this.leaveRepo.findOne({
      where: { id },
      relations: { resident: { user: true, hostel: true }, leaveType: true },
    });
  }

  public async save(leave: LeaveRequest): Promise<LeaveRequest> {
    return this.leaveRepo.save(leave);
  }
}
