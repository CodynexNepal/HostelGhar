// ──────────────────────────────────────────────────────────────────────────────
// FILE: owner.repository.ts
// PURPOSE: Data access layer for Owner operations on Hostels, Residents, LeaveTypes, and Fees.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { User } from '../../entities/user.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { LeaveType } from '../../entities/leave/leave-type.entity';

export class OwnerRepository {
  private hostelRepo: Repository<Hostel>;
  private userRepo: Repository<User>;
  private residentRepo: Repository<Resident>;
  private leaveTypeRepo: Repository<LeaveType>;

  constructor() {
    this.hostelRepo = AppDataSource.getRepository(Hostel);
    this.userRepo = AppDataSource.getRepository(User);
    this.residentRepo = AppDataSource.getRepository(Resident);
    this.leaveTypeRepo = AppDataSource.getRepository(LeaveType);
  }

  public async findHostelByIdAndOwner(hostelId: string, ownerId: string): Promise<Hostel | null> {
    return await this.hostelRepo.findOne({
      where: { id: hostelId, ownerId },
    });
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    return await this.userRepo.findOne({ where: { email } });
  }

  public async createUser(userData: Partial<User>): Promise<User> {
    const user = this.userRepo.create(userData);
    return await this.userRepo.save(user);
  }

  public async createResident(residentData: Partial<Resident>): Promise<Resident> {
    const resident = this.residentRepo.create(residentData);
    return await this.residentRepo.save(resident);
  }

  public async saveResident(resident: Resident): Promise<Resident> {
    return await this.residentRepo.save(resident);
  }

  public async saveHostel(hostel: Hostel): Promise<Hostel> {
    return await this.hostelRepo.save(hostel);
  }

  public async findResidentByIdAndOwner(
    residentId: string,
    ownerId: string,
  ): Promise<Resident | null> {
    return await this.residentRepo.findOne({
      where: {
        id: residentId,
        hostel: { ownerId },
      },
      relations: { hostel: true, user: true },
    });
  }

  public async createLeaveType(leaveTypeData: Partial<LeaveType>): Promise<LeaveType> {
    const leaveType = this.leaveTypeRepo.create(leaveTypeData);
    return await this.leaveTypeRepo.save(leaveType);
  }

  public async findLeaveTypeByName(hostelId: string, name: string): Promise<LeaveType | null> {
    return await this.leaveTypeRepo.findOne({
      where: { hostelId, name },
    });
  }

  public async findResidentsByHostel(hostelId: string): Promise<Resident[]> {
    return await this.residentRepo.find({
      where: { hostelId, isActive: true },
      relations: { user: true },
    });
  }
}
