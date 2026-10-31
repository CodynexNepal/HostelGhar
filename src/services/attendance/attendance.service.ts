// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.service.ts
// PURPOSE: Hostel-scoped attendance listing for Owner/Admin dashboards plus
//          Resident self check-in / check-out with 300-meter geofencing & GeoIP,
//          history tracking, and time spent inside/outside metrics.
// ──────────────────────────────────────────────────────────────────────────────

import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CheckOutAttendanceDto, MarkAttendanceDto } from '../../dto/attendance/mark-attendance.dto';
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
import {
  ALLOWED_ATTENDANCE_RADIUS_METERS,
  calculateDistanceMeters,
  formatDuration,
  lookupIpCoordinates,
} from '../../utils/geolocation.util';

export interface AttendanceListOptions {
  page: number;
  limit: number;
  hostelId?: string | undefined;
  residentId?: string | undefined;
  date?: string | undefined;
  status?: AttendanceStatus | undefined;
}

export interface EnrichedAttendanceRecord extends Attendance {
  lastInTime: Date | null;
  lastOutTime: Date | null;
  timeSpentInHostelMinutes: number;
  timeSpentInHostelFormatted: string;
  timeSpentOutsideMinutes: number;
  timeSpentOutsideFormatted: string;
  isCurrentlyInside: boolean;
}

export interface AttendanceListSummary {
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  currentlyInside: number;
  currentlyOutside: number;
  totalTimeInHostelMinutes: number;
  totalTimeInHostelFormatted: string;
  totalTimeOutsideMinutes: number;
  totalTimeOutsideFormatted: string;
  averageTimeInHostelMinutes: number;
  averageTimeInHostelFormatted: string;
  averageTimeOutsideMinutes: number;
  averageTimeOutsideFormatted: string;
}

export interface AttendanceListResponse extends PaginatedResponse<EnrichedAttendanceRecord> {
  summary: AttendanceListSummary;
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

/**
 * Enriches an Attendance record with calculated stay and outside metrics,
 * last in/out timestamps, and current residency location state.
 */
export const enrichAttendanceRecord = (
  record: Attendance,
  now: Date = new Date(),
): EnrichedAttendanceRecord => {
  const checkIn = record.checkInAt ? new Date(record.checkInAt) : null;
  const checkOut = record.checkOutAt ? new Date(record.checkOutAt) : null;

  let timeSpentInHostelMinutes = 0;
  let timeSpentOutsideMinutes = 0;
  const isCurrentlyInside = Boolean(checkIn && !checkOut);

  if (checkIn) {
    if (checkOut) {
      // Completed stay inside hostel
      timeSpentInHostelMinutes = Math.max(
        0,
        Math.round((checkOut.getTime() - checkIn.getTime()) / 60000),
      );
      // Outside duration since checked out
      timeSpentOutsideMinutes = Math.max(
        0,
        Math.round((now.getTime() - checkOut.getTime()) / 60000),
      );
    } else {
      // Still currently inside hostel
      timeSpentInHostelMinutes = Math.max(
        0,
        Math.round((now.getTime() - checkIn.getTime()) / 60000),
      );
      timeSpentOutsideMinutes = 0;
    }
  } else {
    // Absent or not checked in
    timeSpentInHostelMinutes = 0;
    timeSpentOutsideMinutes = 1440; // 24 hours outside
  }

  return {
    ...record,
    lastInTime: record.checkInAt,
    lastOutTime: record.checkOutAt,
    timeSpentInHostelMinutes,
    timeSpentInHostelFormatted: formatDuration(timeSpentInHostelMinutes),
    timeSpentOutsideMinutes,
    timeSpentOutsideFormatted: formatDuration(timeSpentOutsideMinutes),
    isCurrentlyInside,
  };
};

/**
 * Aggregates summary statistics for attendance records (time inside/outside, headcounts).
 */
export const calculateAttendanceSummary = (
  records: EnrichedAttendanceRecord[],
): AttendanceListSummary => {
  const totalRecords = records.length;
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let currentlyInside = 0;
  let currentlyOutside = 0;
  let totalTimeInHostelMinutes = 0;
  let totalTimeOutsideMinutes = 0;

  for (const r of records) {
    if (r.status === AttendanceStatus.PRESENT) presentCount++;
    else if (r.status === AttendanceStatus.LATE) lateCount++;
    else if (r.status === AttendanceStatus.ABSENT) absentCount++;

    if (r.isCurrentlyInside) currentlyInside++;
    else currentlyOutside++;

    totalTimeInHostelMinutes += r.timeSpentInHostelMinutes;
    totalTimeOutsideMinutes += r.timeSpentOutsideMinutes;
  }

  const averageTimeInHostelMinutes =
    totalRecords > 0 ? Math.round(totalTimeInHostelMinutes / totalRecords) : 0;
  const averageTimeOutsideMinutes =
    totalRecords > 0 ? Math.round(totalTimeOutsideMinutes / totalRecords) : 0;

  return {
    totalRecords,
    presentCount,
    absentCount,
    lateCount,
    currentlyInside,
    currentlyOutside,
    totalTimeInHostelMinutes,
    totalTimeInHostelFormatted: formatDuration(totalTimeInHostelMinutes),
    totalTimeOutsideMinutes,
    totalTimeOutsideFormatted: formatDuration(totalTimeOutsideMinutes),
    averageTimeInHostelMinutes,
    averageTimeInHostelFormatted: formatDuration(averageTimeInHostelMinutes),
    averageTimeOutsideMinutes,
    averageTimeOutsideFormatted: formatDuration(averageTimeOutsideMinutes),
  };
};

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
   * Owner/Admin list with full time inside/outside analytics and history.
   */
  public async list(
    actorId: string,
    role: string,
    options: AttendanceListOptions,
  ): Promise<AttendanceListResponse> {
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
      { l1TtlSeconds: 15, l2TtlSeconds: 60 },
    );

    const enrichedRows = wrapped.data.rows.map((row) => enrichAttendanceRecord(row));
    const summary = calculateAttendanceSummary(enrichedRows);

    const paginated = createPaginatedResponse(enrichedRows, wrapped.data.total, options, {
      isCached: wrapped.isCached,
      cacheLevel: wrapped.cacheLevel,
    });

    return {
      ...paginated,
      summary,
    };
  }

  /**
   * Resident self check-in for today (Nepal date).
   * Geofences resident within 300 meters of the hostel coordinates.
   * If GPS coordinates are not sent in request body, resolves coordinates via GeoIP.
   */
  public async checkIn(
    userId: string,
    dto: MarkAttendanceDto,
    clientIp?: string,
  ): Promise<EnrichedAttendanceRecord> {
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

    const hostel = await AppDataSource.getRepository(Hostel).findOne({
      where: { id: resident.hostelId },
      select: { id: true, name: true, latitude: true, longitude: true },
    });

    // 1. Resolve resident coordinates from payload or GeoIP
    let residentLat = dto.latitude != null ? Number(dto.latitude) : null;
    let residentLon = dto.longitude != null ? Number(dto.longitude) : null;

    if ((residentLat == null || residentLon == null) && clientIp) {
      const geo = lookupIpCoordinates(clientIp);
      if (geo) {
        residentLat = geo.latitude;
        residentLon = geo.longitude;
      }
    }

    // 2. Geofence verification against hostel recorded area (300 meters radius)
    let distanceMeters: number | null = null;
    const hostelLat = hostel?.latitude != null ? Number(hostel.latitude) : null;
    const hostelLon = hostel?.longitude != null ? Number(hostel.longitude) : null;

    if (hostelLat != null && hostelLon != null) {
      if (residentLat != null && residentLon != null) {
        const rawDistance = calculateDistanceMeters(hostelLat, hostelLon, residentLat, residentLon);
        distanceMeters = Math.round(rawDistance * 100) / 100;

        if (distanceMeters > ALLOWED_ATTENDANCE_RADIUS_METERS) {
          throw createHttpError(
            STATUS_CODE.BAD_REQUEST,
            'Come closer to your hostel to checkin or checkout',
          );
        }
      } else {
        throw createHttpError(
          STATUS_CODE.BAD_REQUEST,
          'Come closer to your hostel to checkin or checkout (location coordinates required)',
        );
      }
    }

    const attendance = this.attendanceRepository.create({
      hostelId: resident.hostelId,
      residentId: resident.id,
      date,
      status: dto.status ?? AttendanceStatus.PRESENT,
      checkInAt: new Date(),
      checkInLatitude: residentLat ?? null,
      checkInLongitude: residentLon ?? null,
      checkInDistanceMeters: distanceMeters ?? null,
      checkInIp: clientIp ?? null,
      note: dto.note?.trim() ? dto.note.trim() : null,
      recordedById: userId,
    });
    const saved = await this.attendanceRepository.save(attendance);

    // Fresh check-in must be visible to the owner dashboard immediately.
    await cacheService.invalidatePattern('attendance:list');
    await cacheService.invalidatePattern('attendance:resident');

    return enrichAttendanceRecord(saved);
  }

  /**
   * Resident self check-out for today (Nepal date).
   * Geofences resident within 300 meters of the hostel coordinates.
   */
  public async checkOut(
    userId: string,
    dto?: CheckOutAttendanceDto,
    clientIp?: string,
  ): Promise<EnrichedAttendanceRecord> {
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
    if (!existing) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'You have not checked in for today');
    }
    if (existing.checkOutAt) {
      throw createHttpError(STATUS_CODE.CONFLICT, `You have already checked out for ${date}`);
    }

    const hostel = await AppDataSource.getRepository(Hostel).findOne({
      where: { id: resident.hostelId },
      select: { id: true, name: true, latitude: true, longitude: true },
    });

    let residentLat = dto?.latitude != null ? Number(dto.latitude) : null;
    let residentLon = dto?.longitude != null ? Number(dto.longitude) : null;

    if ((residentLat == null || residentLon == null) && clientIp) {
      const geo = lookupIpCoordinates(clientIp);
      if (geo) {
        residentLat = geo.latitude;
        residentLon = geo.longitude;
      }
    }

    let distanceMeters: number | null = null;
    const hostelLat = hostel?.latitude != null ? Number(hostel.latitude) : null;
    const hostelLon = hostel?.longitude != null ? Number(hostel.longitude) : null;

    if (hostelLat != null && hostelLon != null) {
      if (residentLat != null && residentLon != null) {
        const rawDistance = calculateDistanceMeters(hostelLat, hostelLon, residentLat, residentLon);
        distanceMeters = Math.round(rawDistance * 100) / 100;

        if (distanceMeters > ALLOWED_ATTENDANCE_RADIUS_METERS) {
          throw createHttpError(
            STATUS_CODE.BAD_REQUEST,
            'Come closer to your hostel to checkin or checkout',
          );
        }
      } else {
        throw createHttpError(
          STATUS_CODE.BAD_REQUEST,
          'Come closer to your hostel to checkin or checkout (location coordinates required)',
        );
      }
    }

    existing.checkOutAt = new Date();
    existing.checkOutLatitude = residentLat ?? null;
    existing.checkOutLongitude = residentLon ?? null;
    existing.checkOutDistanceMeters = distanceMeters ?? null;
    existing.checkOutIp = clientIp ?? null;

    if (dto?.note?.trim()) {
      existing.note = existing.note
        ? `${existing.note} | Check-out: ${dto.note.trim()}`
        : `Check-out: ${dto.note.trim()}`;
    }

    const saved = await this.attendanceRepository.save(existing);

    await cacheService.invalidatePattern('attendance:list');
    await cacheService.invalidatePattern('attendance:resident');

    return enrichAttendanceRecord(saved);
  }

  /** Resident's own attendance history, newest first, with inside/outside durations. */
  public async getMyAttendance(
    userId: string,
    page: number,
    limit: number,
  ): Promise<AttendanceListResponse> {
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
      { l1TtlSeconds: 15, l2TtlSeconds: 60 },
    );

    const enrichedRows = wrapped.data.rows.map((row) => enrichAttendanceRecord(row));
    const summary = calculateAttendanceSummary(enrichedRows);

    const paginated = createPaginatedResponse(
      enrichedRows,
      wrapped.data.total,
      { page, limit },
      { isCached: wrapped.isCached, cacheLevel: wrapped.cacheLevel },
    );

    return {
      ...paginated,
      summary,
    };
  }
}
