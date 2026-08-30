import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { LeaveRequest } from '../../entities/leave/leave-request.entity';
import { LeaveStatus } from '../../enum/leave.enum';

export class LeaveRepository {
  private readonly leaveRepo: Repository<LeaveRequest>;

  constructor() {
    this.leaveRepo = AppDataSource.getRepository(LeaveRequest);
  }

  public async findByHostel(hostelId: string, status?: LeaveStatus): Promise<LeaveRequest[]> {
    return this.leaveRepo.find({
      where: {
        resident: { hostelId },
        ...(status ? { status } : {}),
      },
      relations: { resident: { user: true }, leaveType: true },
      order: { createdAt: 'DESC' },
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
