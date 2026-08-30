// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.repository.ts
// PURPOSE: Data access layer for Admin operations on Hostels and Users.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { User } from '../../entities/user.entity';

export class AdminRepository {
  private hostelRepo: Repository<Hostel>;
  private userRepo: Repository<User>;

  constructor() {
    this.hostelRepo = AppDataSource.getRepository(Hostel);
    this.userRepo = AppDataSource.getRepository(User);
  }

  public async createHostel(hostelData: Partial<Hostel>): Promise<Hostel> {
    const hostel = this.hostelRepo.create(hostelData);
    return await this.hostelRepo.save(hostel);
  }

  public async findHostelsWithPagination(page: number, limit: number): Promise<[Hostel[], number]> {
    return await this.hostelRepo.findAndCount({
      relations: {
        owner: true,
        createdByAdmin: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  public async findUserById(id: string): Promise<User | null> {
    return await this.userRepo.findOne({ where: { id } });
  }

  public async findHostelById(id: string): Promise<Hostel | null> {
    return await this.hostelRepo.findOne({
      where: { id },
      relations: { owner: true },
    });
  }

  public async saveHostel(hostel: Hostel): Promise<Hostel> {
    return this.hostelRepo.save(hostel);
  }
}
