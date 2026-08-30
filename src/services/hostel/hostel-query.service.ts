// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-query.service.ts
// PURPOSE: High-performance repository queries with EXPLAIN ANALYZE profile benchmarks,
//          avoiding N+1 problems via SQL aggregation & composite index targeting.
// ──────────────────────────────────────────────────────────────────────────────

import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { LeaveRequest } from '../../entities/leave/leave-request.entity';
import { LeaveStatus } from '../../enum/leave.enum';

export class OptimizedHostelQueryService {
  private hostelRepo = AppDataSource.getRepository(Hostel);
  private leaveRepo = AppDataSource.getRepository(LeaveRequest);

  /**
   * Fetch all Hostels owned by an Owner along with active resident count
   * and today's active leave count in a SINGLE optimized aggregated query.
   *
   * Target Index: idx_hostels_owner_id, idx_residents_hostel_active, idx_leaves_resident_status_dates
   */
  public async getOwnerHostelDashboard(ownerId: string): Promise<any[]> {
    return await this.hostelRepo
      .createQueryBuilder('hostel')
      .leftJoin('hostel.residents', 'resident', 'resident.isActive = :isActive', { isActive: true })
      .leftJoin(
        'resident.leaveRequests',
        'leave',
        'leave.status = :status AND CURRENT_DATE BETWEEN leave.startDate AND leave.endDate',
        { status: LeaveStatus.APPROVED },
      )
      .select([
        'hostel.id AS "hostelId"',
        'hostel.name AS "hostelName"',
        'hostel.type AS "hostelType"',
        'COUNT(DISTINCT resident.id) AS "totalActiveResidents"',
        'COUNT(DISTINCT leave.id) AS "residentsOnLeaveToday"',
      ])
      .where('hostel.ownerId = :ownerId', { ownerId })
      .groupBy('hostel.id')
      .orderBy('hostel.name', 'ASC')
      .getRawMany();
  }

  /**
   * Fetch paginated leaves for a specific resident using composite index.
   * Target Index: idx_leaves_resident_status_dates
   */
  public async getResidentLeaves(
    residentId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<[LeaveRequest[], number]> {
    return await this.leaveRepo.findAndCount({
      where: { residentId },
      relations: {
        leaveType: true,
      },
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * SQL Execution Plan Profiler (EXPLAIN ANALYZE)
   */
  public async profileOwnerDashboardQuery(ownerId: string): Promise<any[]> {
    const rawSql = `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT 
        h.id AS "hostelId",
        h.name AS "hostelName",
        h.type AS "hostelType",
        COUNT(DISTINCT r.id) AS "totalActiveResidents",
        COUNT(DISTINCT l.id) AS "residentsOnLeaveToday"
      FROM hostels h
      LEFT JOIN residents r ON r.hostel_id = h.id AND r.is_active = true
      LEFT JOIN leave_requests l ON l.resident_id = r.id 
           AND l.status = 'APPROVED' 
           AND CURRENT_DATE BETWEEN l.start_date AND l.end_date
      WHERE h.owner_id = $1
      GROUP BY h.id;
    `;
    return await AppDataSource.query(rawSql, [ownerId]);
  }
}

export const optimizedHostelQueryService = new OptimizedHostelQueryService();
