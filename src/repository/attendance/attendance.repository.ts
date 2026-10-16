// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.repository.ts
// PURPOSE: Data access for daily resident attendance with hostel scoping,
//          pagination, and resident-name joins for the owner dashboard.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Attendance } from '../../entities/attendance/attendance.entity';
import { AttendanceStatus } from '../../enum/attendance.enum';

export interface AttendanceFilters {
  hostelId?: string | undefined;
  hostelIds?: string[] | undefined;
  residentId?: string | undefined;
  date?: string | undefined;
  status?: AttendanceStatus | undefined;
}

export class AttendanceRepository {
  private readonly attendanceRepo: Repository<Attendance> = AppDataSource.getRepository(Attendance);

  public create(data: Partial<Attendance>): Attendance {
    return this.attendanceRepo.create(data);
  }

  public save(attendance: Attendance): Promise<Attendance> {
    return this.attendanceRepo.save(attendance);
  }

  public findByResidentAndDate(residentId: string, date: string): Promise<Attendance | null> {
    return this.attendanceRepo.findOne({ where: { residentId, date } });
  }

  /**
   * Paginated list joined with resident + user so the owner dashboard can
   * render names without a second query. Password columns are excluded by
   * explicit select — never rely on entity-wide default selects here.
   */
  public findPage(
    filters: AttendanceFilters,
    page: number,
    limit: number,
  ): Promise<[Attendance[], number]> {
    const query = this.applyFilters(this.attendanceRepo.createQueryBuilder('attendance'), filters);
    return query
      .leftJoinAndSelect('attendance.resident', 'resident')
      .leftJoin('resident.user', 'user')
      .addSelect(['user.firstName', 'user.lastName', 'user.email'])
      .orderBy('attendance.date', 'DESC')
      .addOrderBy('attendance.checkInAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }

  private applyFilters(
    query: SelectQueryBuilder<Attendance>,
    { hostelId, hostelIds, residentId, date, status }: AttendanceFilters,
  ): SelectQueryBuilder<Attendance> {
    if (hostelId) query.andWhere('attendance.hostelId = :hostelId', { hostelId });
    else if (hostelIds) {
      if (hostelIds.length === 0) query.andWhere('1 = 0');
      else query.andWhere('attendance.hostelId IN (:...hostelIds)', { hostelIds });
    }
    if (residentId) query.andWhere('attendance.residentId = :residentId', { residentId });
    if (date) query.andWhere('attendance.date = :date', { date });
    if (status) query.andWhere('attendance.status = :status', { status });
    return query;
  }
}
