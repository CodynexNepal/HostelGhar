"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.service.ts
// PURPOSE: Hostel-scoped attendance listing for Owner/Admin dashboards plus
//          Resident self check-in / check-out with 300-meter geofencing & GeoIP,
//          history tracking, and time spent inside/outside metrics.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = exports.calculateAttendanceSummary = exports.enrichAttendanceRecord = exports.todayAttendanceDate = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const attendance_enum_1 = require("../../enum/attendance.enum");
const roles_enum_1 = require("../../enum/roles.enum");
const attendance_repository_1 = require("../../repository/attendance/attendance.repository");
const database_source_1 = require("../../database/database-source");
const createHttpError_1 = require("../../utils/createHttpError");
const cache_util_1 = require("../../utils/cache.util");
const pagination_util_1 = require("../../utils/pagination.util");
const geolocation_util_1 = require("../../utils/geolocation.util");
// HostelGhar operates on Nepal time (platform timezone Asia/Kathmandu) —
// attendance "days" roll over at Kathmandu midnight, not server/UTC midnight.
const ATTENDANCE_TIMEZONE = 'Asia/Kathmandu';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** Today's date in Asia/Kathmandu as YYYY-MM-DD. */
const todayAttendanceDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
}).format(now);
exports.todayAttendanceDate = todayAttendanceDate;
/**
 * Enriches an Attendance record with calculated stay and outside metrics,
 * last in/out timestamps, and current residency location state.
 */
const enrichAttendanceRecord = (record, now = new Date()) => {
    const checkIn = record.checkInAt ? new Date(record.checkInAt) : null;
    const checkOut = record.checkOutAt ? new Date(record.checkOutAt) : null;
    let timeSpentInHostelMinutes = 0;
    let timeSpentOutsideMinutes = 0;
    const isCurrentlyInside = Boolean(checkIn && !checkOut);
    if (checkIn) {
        if (checkOut) {
            // Completed stay inside hostel
            timeSpentInHostelMinutes = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000));
            // Outside duration since checked out
            timeSpentOutsideMinutes = Math.max(0, Math.round((now.getTime() - checkOut.getTime()) / 60000));
        }
        else {
            // Still currently inside hostel
            timeSpentInHostelMinutes = Math.max(0, Math.round((now.getTime() - checkIn.getTime()) / 60000));
            timeSpentOutsideMinutes = 0;
        }
    }
    else {
        // Absent or not checked in
        timeSpentInHostelMinutes = 0;
        timeSpentOutsideMinutes = 1440; // 24 hours outside
    }
    return {
        ...record,
        lastInTime: record.checkInAt,
        lastOutTime: record.checkOutAt,
        timeSpentInHostelMinutes,
        timeSpentInHostelFormatted: (0, geolocation_util_1.formatDuration)(timeSpentInHostelMinutes),
        timeSpentOutsideMinutes,
        timeSpentOutsideFormatted: (0, geolocation_util_1.formatDuration)(timeSpentOutsideMinutes),
        isCurrentlyInside,
    };
};
exports.enrichAttendanceRecord = enrichAttendanceRecord;
/**
 * Aggregates summary statistics for attendance records (time inside/outside, headcounts).
 */
const calculateAttendanceSummary = (records) => {
    const totalRecords = records.length;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let currentlyInside = 0;
    let currentlyOutside = 0;
    let totalTimeInHostelMinutes = 0;
    let totalTimeOutsideMinutes = 0;
    for (const r of records) {
        if (r.status === attendance_enum_1.AttendanceStatus.PRESENT)
            presentCount++;
        else if (r.status === attendance_enum_1.AttendanceStatus.LATE)
            lateCount++;
        else if (r.status === attendance_enum_1.AttendanceStatus.ABSENT)
            absentCount++;
        if (r.isCurrentlyInside)
            currentlyInside++;
        else
            currentlyOutside++;
        totalTimeInHostelMinutes += r.timeSpentInHostelMinutes;
        totalTimeOutsideMinutes += r.timeSpentOutsideMinutes;
    }
    const averageTimeInHostelMinutes = totalRecords > 0 ? Math.round(totalTimeInHostelMinutes / totalRecords) : 0;
    const averageTimeOutsideMinutes = totalRecords > 0 ? Math.round(totalTimeOutsideMinutes / totalRecords) : 0;
    return {
        totalRecords,
        presentCount,
        absentCount,
        lateCount,
        currentlyInside,
        currentlyOutside,
        totalTimeInHostelMinutes,
        totalTimeInHostelFormatted: (0, geolocation_util_1.formatDuration)(totalTimeInHostelMinutes),
        totalTimeOutsideMinutes,
        totalTimeOutsideFormatted: (0, geolocation_util_1.formatDuration)(totalTimeOutsideMinutes),
        averageTimeInHostelMinutes,
        averageTimeInHostelFormatted: (0, geolocation_util_1.formatDuration)(averageTimeInHostelMinutes),
        averageTimeOutsideMinutes,
        averageTimeOutsideFormatted: (0, geolocation_util_1.formatDuration)(averageTimeOutsideMinutes),
    };
};
exports.calculateAttendanceSummary = calculateAttendanceSummary;
class AttendanceService {
    constructor(attendanceRepository = new attendance_repository_1.AttendanceRepository()) {
        this.attendanceRepository = attendanceRepository;
    }
    isAdmin(role) {
        return role.toLowerCase() === roles_enum_1.IROLES.ADMIN.toLowerCase();
    }
    async authorizeHostel(actorId, role, hostelId) {
        const hostel = await database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel).findOne({ where: { id: hostelId } });
        if (!hostel)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Hostel not found');
        if (!this.isAdmin(role) && hostel.ownerId !== actorId) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'You do not manage this hostel');
        }
        return hostel;
    }
    async ownedHostelIds(ownerId) {
        const rows = await database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel).find({
            where: { ownerId },
            select: { id: true },
        });
        return rows.map((hostel) => hostel.id);
    }
    /**
     * Owner/Admin list with full time inside/outside analytics and history.
     */
    async list(actorId, role, options) {
        if (options.hostelId)
            await this.authorizeHostel(actorId, role, options.hostelId);
        if (options.date && !DATE_ONLY.test(options.date)) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'date must be YYYY-MM-DD');
        }
        const admin = this.isAdmin(role);
        const cacheKey = cache_util_1.cacheService.generateKey('attendance:list', {
            scope: admin ? 'admin' : 'owner',
            actorId,
            hostelId: options.hostelId ?? 'ALL',
            residentId: options.residentId ?? 'ALL',
            date: options.date ?? 'ALL',
            status: options.status ?? 'ALL',
            page: options.page,
            limit: options.limit,
        });
        const wrapped = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const filters = {
                hostelId: options.hostelId,
                residentId: options.residentId,
                date: options.date,
                status: options.status,
            };
            if (!filters.hostelId && !admin) {
                const hostelIds = await this.ownedHostelIds(actorId);
                if (!hostelIds.length)
                    return { rows: [], total: 0 };
                filters.hostelIds = hostelIds;
            }
            const [rows, total] = await this.attendanceRepository.findPage(filters, options.page, options.limit);
            return { rows, total };
        }, { l1TtlSeconds: 15, l2TtlSeconds: 60 });
        const enrichedRows = wrapped.data.rows.map((row) => (0, exports.enrichAttendanceRecord)(row));
        const summary = (0, exports.calculateAttendanceSummary)(enrichedRows);
        const paginated = (0, pagination_util_1.createPaginatedResponse)(enrichedRows, wrapped.data.total, options, {
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
    async checkIn(userId, dto, clientIp) {
        const resident = await database_source_1.AppDataSource.getRepository(resident_entity_1.Resident).findOne({
            where: { userId, isActive: true },
        });
        if (!resident) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Active resident record not found for your account');
        }
        const date = (0, exports.todayAttendanceDate)();
        const existing = await this.attendanceRepository.findByResidentAndDate(resident.id, date);
        if (existing) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.CONFLICT, `You have already checked in for ${date}`);
        }
        const hostel = await database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel).findOne({
            where: { id: resident.hostelId },
            select: { id: true, name: true, latitude: true, longitude: true },
        });
        // 1. Resolve resident coordinates from payload or GeoIP
        let residentLat = dto.latitude != null ? Number(dto.latitude) : null;
        let residentLon = dto.longitude != null ? Number(dto.longitude) : null;
        if ((residentLat == null || residentLon == null) && clientIp) {
            const geo = (0, geolocation_util_1.lookupIpCoordinates)(clientIp);
            if (geo) {
                residentLat = geo.latitude;
                residentLon = geo.longitude;
            }
        }
        // 2. Geofence verification against hostel recorded area (300 meters radius)
        let distanceMeters = null;
        const hostelLat = hostel?.latitude != null ? Number(hostel.latitude) : null;
        const hostelLon = hostel?.longitude != null ? Number(hostel.longitude) : null;
        if (hostelLat != null && hostelLon != null) {
            if (residentLat != null && residentLon != null) {
                const rawDistance = (0, geolocation_util_1.calculateDistanceMeters)(hostelLat, hostelLon, residentLat, residentLon);
                distanceMeters = Math.round(rawDistance * 100) / 100;
                if (distanceMeters > geolocation_util_1.ALLOWED_ATTENDANCE_RADIUS_METERS) {
                    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Come closer to your hostel to checkin or checkout');
                }
            }
            else {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Come closer to your hostel to checkin or checkout (location coordinates required)');
            }
        }
        const attendance = this.attendanceRepository.create({
            hostelId: resident.hostelId,
            residentId: resident.id,
            date,
            status: dto.status ?? attendance_enum_1.AttendanceStatus.PRESENT,
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
        await cache_util_1.cacheService.invalidatePattern('attendance:list');
        await cache_util_1.cacheService.invalidatePattern('attendance:resident');
        return (0, exports.enrichAttendanceRecord)(saved);
    }
    /**
     * Resident self check-out for today (Nepal date).
     * Geofences resident within 300 meters of the hostel coordinates.
     */
    async checkOut(userId, dto, clientIp) {
        const resident = await database_source_1.AppDataSource.getRepository(resident_entity_1.Resident).findOne({
            where: { userId, isActive: true },
        });
        if (!resident) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Active resident record not found for your account');
        }
        const date = (0, exports.todayAttendanceDate)();
        const existing = await this.attendanceRepository.findByResidentAndDate(resident.id, date);
        if (!existing) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'You have not checked in for today');
        }
        if (existing.checkOutAt) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.CONFLICT, `You have already checked out for ${date}`);
        }
        const hostel = await database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel).findOne({
            where: { id: resident.hostelId },
            select: { id: true, name: true, latitude: true, longitude: true },
        });
        let residentLat = dto?.latitude != null ? Number(dto.latitude) : null;
        let residentLon = dto?.longitude != null ? Number(dto.longitude) : null;
        if ((residentLat == null || residentLon == null) && clientIp) {
            const geo = (0, geolocation_util_1.lookupIpCoordinates)(clientIp);
            if (geo) {
                residentLat = geo.latitude;
                residentLon = geo.longitude;
            }
        }
        let distanceMeters = null;
        const hostelLat = hostel?.latitude != null ? Number(hostel.latitude) : null;
        const hostelLon = hostel?.longitude != null ? Number(hostel.longitude) : null;
        if (hostelLat != null && hostelLon != null) {
            if (residentLat != null && residentLon != null) {
                const rawDistance = (0, geolocation_util_1.calculateDistanceMeters)(hostelLat, hostelLon, residentLat, residentLon);
                distanceMeters = Math.round(rawDistance * 100) / 100;
                if (distanceMeters > geolocation_util_1.ALLOWED_ATTENDANCE_RADIUS_METERS) {
                    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Come closer to your hostel to checkin or checkout');
                }
            }
            else {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Come closer to your hostel to checkin or checkout (location coordinates required)');
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
        await cache_util_1.cacheService.invalidatePattern('attendance:list');
        await cache_util_1.cacheService.invalidatePattern('attendance:resident');
        return (0, exports.enrichAttendanceRecord)(saved);
    }
    /** Resident's own attendance history, newest first, with inside/outside durations. */
    async getMyAttendance(userId, page, limit) {
        const resident = await database_source_1.AppDataSource.getRepository(resident_entity_1.Resident).findOne({
            where: { userId, isActive: true },
        });
        if (!resident) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Active resident record not found for your account');
        }
        const cacheKey = cache_util_1.cacheService.generateKey('attendance:resident', {
            residentId: resident.id,
            page,
            limit,
        });
        const wrapped = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const [rows, total] = await this.attendanceRepository.findPage({ residentId: resident.id }, page, limit);
            return { rows, total };
        }, { l1TtlSeconds: 15, l2TtlSeconds: 60 });
        const enrichedRows = wrapped.data.rows.map((row) => (0, exports.enrichAttendanceRecord)(row));
        const summary = (0, exports.calculateAttendanceSummary)(enrichedRows);
        const paginated = (0, pagination_util_1.createPaginatedResponse)(enrichedRows, wrapped.data.total, { page, limit }, { isCached: wrapped.isCached, cacheLevel: wrapped.cacheLevel });
        return {
            ...paginated,
            summary,
        };
    }
}
exports.AttendanceService = AttendanceService;
