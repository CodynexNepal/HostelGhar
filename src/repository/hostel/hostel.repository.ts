import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { LeaveType } from '../../entities/leave/leave-type.entity';

export class HostelRepository {
  private readonly hostelRepo: Repository<Hostel>;
  private readonly residentRepo: Repository<Resident>;
  private readonly leaveTypeRepo: Repository<LeaveType>;

  constructor() {
    this.hostelRepo = AppDataSource.getRepository(Hostel);
    this.residentRepo = AppDataSource.getRepository(Resident);
    this.leaveTypeRepo = AppDataSource.getRepository(LeaveType);
  }

  public async findAll(page: number, limit: number): Promise<[Hostel[], number]> {
    return this.hostelRepo.findAndCount({
      relations: { owner: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public async findById(id: string): Promise<Hostel | null> {
    return this.hostelRepo.findOne({
      where: { id },
      relations: { owner: true, createdByAdmin: true },
    });
  }

  public async findResidents(hostelId: string): Promise<Resident[]> {
    return this.residentRepo.find({
      where: { hostelId, isActive: true },
      relations: { user: true },
      order: { roomNumber: 'ASC' },
    });
  }

  public async findLeaveTypes(hostelId: string): Promise<LeaveType[]> {
    return this.leaveTypeRepo.find({
      where: { hostelId },
      order: { name: 'ASC' },
    });
  }
}
