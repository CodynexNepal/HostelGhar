// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.service.ts
// PURPOSE: Hostel-scoped attendance listing for Owner/Admin dashboards plus
//          Resident self check-in (one record per resident per Nepal day).
// ──────────────────────────────────────────────────────────────────────────────

import { STATUS_CODE } from '../../constant/statusCode.interface';
import { MarkAttendanceDto } from '../../dto/attendance/mark-attendance.dto';
import { Attendance } from '../../entities/attendance/attendance.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { AttendanceStatus } from '../../enum/attendance.enum';
import { IROLES } from '../../enum/roles.enum';
import {
  AttendanceFilters,
  AttendanceRepository,
} from '../../repository/attendance/attendance.repository';
import { AppDataSource } from '../../database/database-source';
import { createHttpError } from '../../utils/createHttpError';
import { cacheService } from '../../utils/cache.util';
import { createPaginatedResponse, PaginatedResponse } from '../../utils/pagination.util';

export interface AttendanceListOptions {
  page: number;
  limit: number;
  hostelId?: string | undefined;
  residentId?: string | undefined;
  date?: string | undefined;
  status?: AttendanceStatus | undefined;
}

// HostelGhar operates on Nepal time (platform timezone Asia/Kathmandu) —
// attendance "days" roll over at Kathmandu midnight, not server/UTC midnight.
const ATTENDANCE_TIMEZONE = 'Asia/Kathmandu';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in Asia/Kathmandu as YYYY-MM-DD. */
export const todayAttendanceDate = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export class AttendanceService {
  constructor(private readonly attendanceRepository = new AttendanceRepository()) {}

  protected isAdmin(role: string): boolean {
    return role.toLowerCase() === IROLES.ADMIN.toLowerCase();
  }

  protected async authorizeHostel(
    actorId: string,
    role: string,
    hostelId: string,
  ): Promise<Hostel> {
    const hostel = await AppDataSource.getRepository(Hostel).findOne({ where: { id: hostelId } });
    if (!hostel) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Hostel not found');
    if (!this.isAdmin(role) && hostel.ownerId !== actorId) {
      throw createHttpError(STATUS_CODE.FORBIDDEN, 'You do not manage this hostel');
    }
    return hostel;
  }

  protected async ownedHostelIds(ownerId: string): Promise<string[]> {
    const rows = await AppDataSource.getRepository(Hostel).find({
      where: { ownerId },
      select: { id: true },
    });
    return rows.map((hostel) => hostel.id);
  }

  /**
   * Owner/Admin list. hostelId narrows to one hostel (ownership-checked);
   * omitting it spans all the owner's hostels (admins see everything).
   */
  public async list(
    actorId: string,
    role: string,
    options: AttendanceListOptions,
  ): Promise<PaginatedResponse<Attendance>> {
    if (options.hostelId) await this.authorizeHostel(actorId, role, options.hostelId);
    if (options.date && !DATE_ONLY.test(options.date)) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'date must be YYYY-MM-DD');
    }

    const admin = this.isAdmin(role);
    const cacheKey = cacheService.generateKey('attendance:list', {
      scope: admin ? 'admin' : 'owner',
      actorId,
      hostelId: options.hostelId ?? 'ALL',
      residentId: options.residentId ?? 'ALL',
      date: options.date ?? 'ALL',
      status: options.status ?? 'ALL',
      page: options.page,
      limit: options.limit,
    });

    const wrapped = await cacheService.wrap(
      cacheKey,
      async (): Promise<{ rows: Attendance[]; total: number }> => {
        const filters: AttendanceFilters = {
          hostelId: options.hostelId,
          residentId: options.residentId,
          date: options.date,
          status: options.status,
        };
        if (!filters.hostelId && !admin) {
          const hostelIds = await this.ownedHostelIds(actorId);
          if (!hostelIds.length) return { rows: [] as Attendance[], total: 0 };
          filters.hostelIds = hostelIds;
        }
        const [rows, total] = await this.attendanceRepository.findPage(
          filters,
          options.page,
          options.limit,
        );
        return { rows, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    return createPaginatedResponse(wrapped.data.rows, wrapped.data.total, options, {
      isCached: wrapped.isCached,
      cacheLevel: wrapped.cacheLevel,
    });
  }

  /**
   * Resident self check-in for today (Nepal date). One row per resident per
   * day — a second check-in returns 409 with the existing record.
   */
  public async checkIn(userId: string, dto: MarkAttendanceDto): Promise<Attendance> {
    const resident = await AppDataSource.getRepository(Resident).findOne({
      where: { userId, isActive: true },
    });
    if (!resident) {
      throw createHttpError(
        STATUS_CODE.NOT_FOUND,
        'Active resident record not found for your account',
      );
    }

    const date = todayAttendanceDate();
    const existing = await this.attendanceRepository.findByResidentAndDate(resident.id, date);
    if (existing) {
      throw createHttpError(STATUS_CODE.CONFLICT, `You have already checked in for ${date}`);
    }

    const attendance = this.attendanceRepository.create({
      hostelId: resident.hostelId,
      residentId: resident.id,
      date,
      status: dto.status ?? AttendanceStatus.PRESENT,
      checkInAt: new Date(),
      note: dto.note?.trim() ? dto.note.trim() : null,
      recordedById: userId,
    });
    const saved = await this.attendanceRepository.save(attendance);

    // Fresh check-in must be visible to the owner dashboard immediately.
    await cacheService.invalidatePattern('attendance:list');
    await cacheService.invalidatePattern('attendance:resident');

    return saved;
  }

  /** Resident's own attendance history, newest first. */
  public async getMyAttendance(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<Attendance>> {
    const resident = await AppDataSource.getRepository(Resident).findOne({
      where: { userId, isActive: true },
    });
    if (!resident) {
      throw createHttpError(
        STATUS_CODE.NOT_FOUND,
        'Active resident record not found for your account',
      );
    }

    const cacheKey = cacheService.generateKey('attendance:resident', {
      residentId: resident.id,
      page,
      limit,
    });
    const wrapped = await cacheService.wrap(
      cacheKey,
      async (): Promise<{ rows: Attendance[]; total: number }> => {
        const [rows, total] = await this.attendanceRepository.findPage(
          { residentId: resident.id },
          page,
          limit,
        );
        return { rows, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    return createPaginatedResponse(
      wrapped.data.rows,
      wrapped.data.total,
      { page, limit },
      { isCached: wrapped.isCached, cacheLevel: wrapped.cacheLevel },
    );
  }
}
