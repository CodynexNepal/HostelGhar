// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-query.service.ts
// PURPOSE: High-performance repository queries with EXPLAIN ANALYZE profile benchmarks,
//          avoiding N+1 problems via SQL aggregation & composite index targeting.
// ──────────────────────────────────────────────────────────────────────────────

import { In } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { LeaveRequest } from '../../entities/leave/leave-request.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { Room } from '../../entities/room/room.entity';
import { Fee } from '../../entities/fee/fee.entity';
import { LeaveStatus } from '../../enum/leave.enum';
import { FeeStatus } from '../../enum/fee.enum';
import { RoomStatus } from '../../enum/room.enum';

export interface OwnerDashboardHostelRow {
  hostelId: string;
  hostelName: string;
  hostelType: string;
  totalActiveResidents: number;
  residentsOnLeaveToday: number;
}

export interface OwnerDashboardSummary {
  totalResidents: number;
  residentsOnLeaveToday: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  monthlyRevenue: number;
  pendingPayments: number;
  pendingCount: number;
  totalHostels: number;
}

export interface OwnerDashboardFloorRow {
  floor: number | null;
  label: string;
  roomCount: number;
}

export interface OwnerDashboardRoomMixRow {
  type: string;
  roomCount: number;
}

export interface OwnerDashboardRevenuePoint {
  billingYear: number;
  billingMonth: number;
  label: string;
  collected: number;
  outstanding: number;
}

export interface OwnerDashboardRecentPayment {
  feeId: string;
  residentId: string;
  residentName: string | null;
  hostelId: string;
  hostelName: string | null;
  roomNumber: string | null;
  paidAmount: number;
  totalPayable: number;
  status: string;
  billingMonth: number;
  billingYear: number;
  updatedAt: Date;
}

/**
 * Rich payload for `GET /owner/dashboard`.
 * `hostels` keeps the LEGACY flat array shape so existing clients that treat
 * `data` as an array keep working; every other block is additive.
 */
export interface OwnerDashboardResponse {
  hostels: OwnerDashboardHostelRow[];
  summary: OwnerDashboardSummary;
  floorOverview: OwnerDashboardFloorRow[];
  roomMix: OwnerDashboardRoomMixRow[];
  revenueTrend: OwnerDashboardRevenuePoint[];
  recentPayments: OwnerDashboardRecentPayment[];
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export class OptimizedHostelQueryService {
  private hostelRepo = AppDataSource.getRepository(Hostel);
  private leaveRepo = AppDataSource.getRepository(LeaveRequest);

  /**
   * Fetch the OWNER DASHBOARD payload in a handful of aggregated queries
   * (no N+1): per-hostel resident/leave counts, room inventory (beds, floors,
   * types), current-month collections, outstanding dues and the last 6 billing
   * periods of revenue plus the 5 most recent fee movements.
   *
   * Target Index: idx_hostels_owner_id, idx_residents_hostel_active,
   * idx_leaves_resident_status_dates, idx_rooms_owner_id, idx_fees_hostel_month_year.
   *
   * Occupancy source of truth = ACTIVE residents (rooms.occupied is max()'d in
   * because it can be manually synced higher — same rule as the Add-Resident
   * form-options dropdowns, so the dashboard and the dropdowns never disagree).
   */
  public async getOwnerHostelDashboard(ownerId: string): Promise<OwnerDashboardResponse> {
    const hostelRows = await this.hostelRepo
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

    const hostels: OwnerDashboardHostelRow[] = (hostelRows ?? []).map(
      (row: Record<string, unknown>) => ({
        hostelId: String(row.hostelId),
        hostelName: String(row.hostelName),
        hostelType: String(row.hostelType),
        totalActiveResidents: Number(row.totalActiveResidents) || 0,
        residentsOnLeaveToday: Number(row.residentsOnLeaveToday) || 0,
      }),
    );

    const hostelIds = hostels.map((h) => h.hostelId);
    const now = new Date();
    const billingMonth = now.getMonth() + 1;
    const billingYear = now.getFullYear();

    const residentRepo = AppDataSource.getRepository(Resident);
    const roomRepo = AppDataSource.getRepository(Room);
    const feeRepo = AppDataSource.getRepository(Fee);

    // ── Room inventory owned by this login (includes hostelId=NULL rooms that
    //    were created before linking a hostel — same scope as /rooms) ──────────
    const ownerRooms = await roomRepo.find({
      where: { ownerId },
      select: {
        id: true,
        hostelId: true,
        roomNumber: true,
        type: true,
        capacity: true,
        occupied: true,
        floor: true,
        status: true,
      },
    });

    const totalRooms = ownerRooms.length;
    const totalBeds = ownerRooms.reduce((sum, room) => sum + (Number(room.capacity) || 0), 0);

    let occupiedFromResidents = 0;
    if (hostelIds.length > 0) {
      occupiedFromResidents = await residentRepo.count({
        where: { hostelId: In(hostelIds), isActive: true },
      });
    }
    const occupiedFromRooms = ownerRooms.reduce(
      (sum, room) => sum + (Number(room.occupied) || 0),
      0,
    );
    const occupiedBeds = Math.max(occupiedFromResidents, occupiedFromRooms);
    const availableBeds = Math.max(totalBeds - occupiedBeds, 0);
    // Rounded to 1 decimal (e.g. 66.7) so the UI can print "66.7%" directly.
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;

    const availableRooms = ownerRooms.filter((room) => {
      const freeBeds = (Number(room.capacity) || 0) - (Number(room.occupied) || 0);
      return String(room.status) === RoomStatus.AVAILABLE && freeBeds > 0;
    }).length;
    const occupiedRooms = ownerRooms.filter(
      (room) => String(room.status) === RoomStatus.OCCUPIED,
    ).length;

    // ── Floor overview (flat = Room.floor alias; NULL → "Unassigned") ─────────
    const floorMap = new Map<string, OwnerDashboardFloorRow>();
    for (const room of ownerRooms) {
      const key = room.floor == null ? 'null' : String(room.floor);
      const entry = floorMap.get(key) ?? {
        floor: room.floor ?? null,
        label: room.floor == null ? 'Unassigned' : `Floor ${room.floor}`,
        roomCount: 0,
      };
      entry.roomCount += 1;
      floorMap.set(key, entry);
    }
    const floorOverview = [...floorMap.values()].sort((a, b) => (a.floor ?? -1) - (b.floor ?? -1));

    // ── Room mix by type ──────────────────────────────────────────────────────
    const mixMap = new Map<string, number>();
    for (const room of ownerRooms) {
      const type = String(room.type ?? 'UNKNOWN');
      mixMap.set(type, (mixMap.get(type) ?? 0) + 1);
    }
    const roomMix: OwnerDashboardRoomMixRow[] = [...mixMap.entries()]
      .map(([type, roomCount]) => ({ type, roomCount }))
      .sort((a, b) => b.roomCount - a.roomCount);

    // ── Fees: collected this month, outstanding follow-ups, 6-month trend ─────
    let monthlyRevenue = 0;
    let pendingPayments = 0;
    let pendingCount = 0;
    let revenueTrend: OwnerDashboardRevenuePoint[] = [];
    let recentPayments: OwnerDashboardRecentPayment[] = [];

    if (hostelIds.length > 0) {
      const [monthRow, pendingRow, trendRows, recentFees] = await Promise.all([
        // "Monthly Revenue — collected this month": fee rows billed for the
        // CURRENT AD month/year (billing is stored on the AD calendar).
        feeRepo
          .createQueryBuilder('fee')
          .select('COALESCE(SUM(fee.paidAmount), 0)', 'collected')
          .where('fee.hostelId IN (:...hostelIds)', { hostelIds })
          .andWhere('fee.billingMonth = :billingMonth', { billingMonth })
          .andWhere('fee.billingYear = :billingYear', { billingYear })
          .getRawOne<{ collected: string }>(),
        // "Pending Payments — follow-up needed": everything not fully PAID
        // (PENDING + PARTIALLY_PAID + OVERDUE), same rule as
        // findPendingFeesByResident().
        feeRepo
          .createQueryBuilder('fee')
          .select('COALESCE(SUM(fee.totalPayable - fee.paidAmount), 0)', 'outstanding')
          .addSelect('COUNT(fee.id)', 'cnt')
          .where('fee.hostelId IN (:...hostelIds)', { hostelIds })
          .andWhere('fee.status != :paid', { paid: FeeStatus.PAID })
          .getRawOne<{ outstanding: string; cnt: string }>(),
        // Last 6 billing periods (AD month/year), oldest → newest for charting.
        feeRepo
          .createQueryBuilder('fee')
          .select('fee.billingYear', 'billingYear')
          .addSelect('fee.billingMonth', 'billingMonth')
          .addSelect('COALESCE(SUM(fee.paidAmount), 0)', 'collected')
          .addSelect('COALESCE(SUM(fee.totalPayable - fee.paidAmount), 0)', 'outstanding')
          .where('fee.hostelId IN (:...hostelIds)', { hostelIds })
          .groupBy('fee.billingYear')
          .addGroupBy('fee.billingMonth')
          .orderBy('fee.billingYear', 'DESC')
          .addOrderBy('fee.billingMonth', 'DESC')
          .limit(6)
          .getRawMany<{
            billingYear: string;
            billingMonth: string;
            collected: string;
            outstanding: string;
          }>(),
        // Latest movements so the "Recent payments" list is never empty.
        feeRepo.find({
          where: { hostelId: In(hostelIds) },
          relations: { resident: { user: true }, hostel: true },
          order: { updatedAt: 'DESC' },
          take: 5,
        }),
      ]);

      monthlyRevenue = Number(monthRow?.collected) || 0;
      pendingPayments = Number(pendingRow?.outstanding) || 0;
      pendingCount = Number(pendingRow?.cnt) || 0;

      revenueTrend = (trendRows ?? [])
        .map((row) => ({
          billingYear: Number(row.billingYear),
          billingMonth: Number(row.billingMonth),
          label: MONTH_SHORT[(Number(row.billingMonth) - 1 + 12) % 12] ?? '',
          collected: Number(row.collected) || 0,
          outstanding: Number(row.outstanding) || 0,
        }))
        .sort((a, b) => a.billingYear - b.billingYear || a.billingMonth - b.billingMonth);

      recentPayments = (recentFees ?? []).map((fee) => ({
        feeId: fee.id,
        residentId: fee.residentId,
        residentName:
          fee.resident?.user != null
            ? `${fee.resident.user.firstName ?? ''} ${fee.resident.user.lastName ?? ''}`.trim() ||
              null
            : null,
        hostelId: fee.hostelId,
        hostelName: fee.hostel?.name ?? null,
        roomNumber: fee.resident?.roomNumber ?? null,
        paidAmount: Number(fee.paidAmount) || 0,
        totalPayable: Number(fee.totalPayable) || 0,
        status: String(fee.status),
        billingMonth: Number(fee.billingMonth),
        billingYear: Number(fee.billingYear),
        updatedAt: fee.updatedAt,
      }));
    }

    const summary: OwnerDashboardSummary = {
      totalResidents: hostels.reduce((sum, h) => sum + h.totalActiveResidents, 0),
      residentsOnLeaveToday: hostels.reduce((sum, h) => sum + h.residentsOnLeaveToday, 0),
      totalBeds,
      occupiedBeds,
      availableBeds,
      occupancyRate,
      totalRooms,
      availableRooms,
      occupiedRooms,
      monthlyRevenue,
      pendingPayments,
      pendingCount,
      totalHostels: hostels.length,
    };

    return { hostels, summary, floorOverview, roomMix, revenueTrend, recentPayments };
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
