// ──────────────────────────────────────────────────────────────────────────────
// FILE: staff.repository.ts
// PURPOSE: Data access for hostel staff with hostel scoping + pagination.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Staff } from '../../entities/staff/staff.entity';
import { StaffRole, StaffShift, StaffStatus } from '../../enum/staff.enum';

export interface StaffFilters {
  hostelId?: string | undefined;
  hostelIds?: string[] | undefined;
  role?: StaffRole | undefined;
  shift?: StaffShift | undefined;
  status?: StaffStatus | undefined;
  search?: string | undefined;
}

export class StaffRepository {
  private readonly staffRepo: Repository<Staff> = AppDataSource.getRepository(Staff);

  public create(data: Partial<Staff>): Staff {
    return this.staffRepo.create(data);
  }

  public save(staff: Staff): Promise<Staff> {
    return this.staffRepo.save(staff);
  }

  public findById(id: string): Promise<Staff | null> {
    return this.staffRepo.findOne({ where: { id }, relations: { hostel: true } });
  }

  public findPage(filters: StaffFilters, page: number, limit: number): Promise<[Staff[], number]> {
    const query = this.applyFilters(this.staffRepo.createQueryBuilder('staff'), filters);
    return query
      .leftJoinAndSelect('staff.hostel', 'hostel')
      .orderBy('staff.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }

  public remove(staff: Staff): Promise<Staff> {
    return this.staffRepo.remove(staff);
  }

  private applyFilters(
    query: SelectQueryBuilder<Staff>,
    { hostelId, hostelIds, role, shift, status, search }: StaffFilters,
  ): SelectQueryBuilder<Staff> {
    if (hostelId) query.andWhere('staff.hostelId = :hostelId', { hostelId });
    else if (hostelIds) {
      if (hostelIds.length === 0) query.andWhere('1 = 0');
      else query.andWhere('staff.hostelId IN (:...hostelIds)', { hostelIds });
    }
    if (role) query.andWhere('staff.role = :role', { role });
    if (shift) query.andWhere('staff.shift = :shift', { shift });
    if (status) query.andWhere('staff.status = :status', { status });
    if (search) {
      query.andWhere('(staff.fullName ILIKE :search OR staff.phone ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    return query;
  }
}
