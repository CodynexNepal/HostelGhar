// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.repository.ts
// PURPOSE: Data access layer for Admin operations on Hostels and Users.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { HostelType } from '../../enum/hostel.enum';
import { User } from '../../entities/user.entity';
import { Resident } from '../../entities/resident/resident.entity';

export class AdminRepository {
  private hostelRepo: Repository<Hostel>;
  private userRepo: Repository<User>;
  private residentRepo: Repository<Resident>;

  constructor() {
    this.hostelRepo = AppDataSource.getRepository(Hostel);
    this.userRepo = AppDataSource.getRepository(User);
    this.residentRepo = AppDataSource.getRepository(Resident);
  }

  // ─── 1. Persist contact/location info sent by the admin form ──────────────
  // dto.city/address/phone/email are whitelisted by CreateHostelDto; the
  // entity columns are nullable so old rows without them keep working.
  public async createHostel(hostelData: {
    name: string;
    type: HostelType;
    city?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    ownerId: string | null;
    createdByAdminId: string;
  }): Promise<Hostel> {
    const hostel = this.hostelRepo.create({
      name: hostelData.name,
      type: hostelData.type,
      city: hostelData.city ?? null,
      address: hostelData.address ?? null,
      phone: hostelData.phone ?? null,
      email: hostelData.email ?? null,
      ownerId: hostelData.ownerId,
      createdByAdminId: hostelData.createdByAdminId,
    });
    return await this.hostelRepo.save(hostel);
  }

  public async findHostelsWithPagination(page: number, limit: number): Promise<[Hostel[], number]> {
    return await this.hostelRepo.findAndCount({
      relations: {
        owner: true,
        createdByAdmin: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        ownerId: false,
        createdByAdminId: false,
        createdAt: true,
        updatedAt: true,
        createdByAdmin: { id: true, firstName: true, lastName: true, email: true },
        owner: { id: true, firstName: true, lastName: true, email: true },
      },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  public async findUserById(id: string): Promise<User | null> {
    return await this.userRepo.findOne({ where: { id } });
  }

  /**
   * Counts ACTIVE residents per hostel in ONE query (no N+1).
   * Returns Map<hostelId, activeResidentCount>. Empty input → empty map.
   */
  public async countActiveResidentsByHostel(hostelIds: string[]): Promise<Map<string, number>> {
    if (hostelIds.length === 0) return new Map();
    const rows = await this.residentRepo
      .createQueryBuilder('r')
      .select('r.hostelId', 'hostelId')
      .addSelect('COUNT(r.id)', 'cnt')
      .where('r.hostelId IN (:...hostelIds)', { hostelIds })
      .andWhere('r.isActive = :isActive', { isActive: true })
      .groupBy('r.hostelId')
      .getRawMany<{ hostelId: string; cnt: string }>();
    return new Map(rows.map((r) => [r.hostelId, Number(r.cnt)]));
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
