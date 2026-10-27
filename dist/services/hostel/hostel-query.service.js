"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-query.service.ts
// PURPOSE: High-performance repository queries with EXPLAIN ANALYZE profile benchmarks,
//          avoiding N+1 problems via SQL aggregation & composite index targeting.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizedHostelQueryService = exports.OptimizedHostelQueryService = void 0;
const typeorm_1 = require("typeorm");
const database_source_1 = require("../../database/database-source");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const leave_request_entity_1 = require("../../entities/leave/leave-request.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const room_entity_1 = require("../../entities/room/room.entity");
const fee_entity_1 = require("../../entities/fee/fee.entity");
const leave_enum_1 = require("../../enum/leave.enum");
const fee_enum_1 = require("../../enum/fee.enum");
const room_enum_1 = require("../../enum/room.enum");
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
];
class OptimizedHostelQueryService {
    constructor() {
        this.hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        this.leaveRepo = database_source_1.AppDataSource.getRepository(leave_request_entity_1.LeaveRequest);
    }
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
    async getOwnerHostelDashboard(ownerId) {
        const hostelRows = await this.hostelRepo
            .createQueryBuilder('hostel')
            .leftJoin('hostel.residents', 'resident', 'resident.isActive = :isActive', { isActive: true })
            .leftJoin('resident.leaveRequests', 'leave', 'leave.status = :status AND CURRENT_DATE BETWEEN leave.startDate AND leave.endDate', { status: leave_enum_1.LeaveStatus.APPROVED })
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
        const hostels = (hostelRows ?? []).map((row) => ({
            hostelId: String(row.hostelId),
            hostelName: String(row.hostelName),
            hostelType: String(row.hostelType),
            totalActiveResidents: Number(row.totalActiveResidents) || 0,
            residentsOnLeaveToday: Number(row.residentsOnLeaveToday) || 0,
        }));
        const hostelIds = hostels.map((h) => h.hostelId);
        const now = new Date();
        const billingMonth = now.getMonth() + 1;
        const billingYear = now.getFullYear();
        const residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        const roomRepo = database_source_1.AppDataSource.getRepository(room_entity_1.Room);
        const feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
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
                where: { hostelId: (0, typeorm_1.In)(hostelIds), isActive: true },
            });
        }
        const occupiedFromRooms = ownerRooms.reduce((sum, room) => sum + (Number(room.occupied) || 0), 0);
        const occupiedBeds = Math.max(occupiedFromResidents, occupiedFromRooms);
        const availableBeds = Math.max(totalBeds - occupiedBeds, 0);
        // Rounded to 1 decimal (e.g. 66.7) so the UI can print "66.7%" directly.
        const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;
        const availableRooms = ownerRooms.filter((room) => {
            const freeBeds = (Number(room.capacity) || 0) - (Number(room.occupied) || 0);
            return String(room.status) === room_enum_1.RoomStatus.AVAILABLE && freeBeds > 0;
        }).length;
        const occupiedRooms = ownerRooms.filter((room) => String(room.status) === room_enum_1.RoomStatus.OCCUPIED).length;
        // ── Floor overview (flat = Room.floor alias; NULL → "Unassigned") ─────────
        const floorMap = new Map();
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
        const mixMap = new Map();
        for (const room of ownerRooms) {
            const type = String(room.type ?? 'UNKNOWN');
            mixMap.set(type, (mixMap.get(type) ?? 0) + 1);
        }
        const roomMix = [...mixMap.entries()]
            .map(([type, roomCount]) => ({ type, roomCount }))
            .sort((a, b) => b.roomCount - a.roomCount);
        // ── Fees: collected this month, outstanding follow-ups, 6-month trend ─────
        let monthlyRevenue = 0;
        let pendingPayments = 0;
        let pendingCount = 0;
        let revenueTrend = [];
        let recentPayments = [];
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
                    .getRawOne(),
                // "Pending Payments — follow-up needed": everything not fully PAID
                // (PENDING + PARTIALLY_PAID + OVERDUE), same rule as
                // findPendingFeesByResident().
                feeRepo
                    .createQueryBuilder('fee')
                    .select('COALESCE(SUM(fee.totalPayable - fee.paidAmount), 0)', 'outstanding')
                    .addSelect('COUNT(fee.id)', 'cnt')
                    .where('fee.hostelId IN (:...hostelIds)', { hostelIds })
                    .andWhere('fee.status != :paid', { paid: fee_enum_1.FeeStatus.PAID })
                    .getRawOne(),
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
                    .getRawMany(),
                // Latest movements so the "Recent payments" list is never empty.
                feeRepo.find({
                    where: { hostelId: (0, typeorm_1.In)(hostelIds) },
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
                residentName: fee.resident?.user != null
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
        const summary = {
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
    async getResidentLeaves(residentId, page = 1, limit = 10) {
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
    async profileOwnerDashboardQuery(ownerId) {
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
        return await database_source_1.AppDataSource.query(rawSql, [ownerId]);
    }
}
exports.OptimizedHostelQueryService = OptimizedHostelQueryService;
exports.optimizedHostelQueryService = new OptimizedHostelQueryService();
