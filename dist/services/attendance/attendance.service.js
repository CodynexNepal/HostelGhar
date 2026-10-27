"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.service.ts
// PURPOSE: Hostel-scoped attendance listing for Owner/Admin dashboards plus
//          Resident self check-in (one record per resident per Nepal day).
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = exports.todayAttendanceDate = void 0;
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
     * Owner/Admin list. hostelId narrows to one hostel (ownership-checked);
     * omitting it spans all the owner's hostels (admins see everything).
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
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return (0, pagination_util_1.createPaginatedResponse)(wrapped.data.rows, wrapped.data.total, options, {
            isCached: wrapped.isCached,
            cacheLevel: wrapped.cacheLevel,
        });
    }
    /**
     * Resident self check-in for today (Nepal date). One row per resident per
     * day — a second check-in returns 409 with the existing record.
     */
    async checkIn(userId, dto) {
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
        const attendance = this.attendanceRepository.create({
            hostelId: resident.hostelId,
            residentId: resident.id,
            date,
            status: dto.status ?? attendance_enum_1.AttendanceStatus.PRESENT,
            checkInAt: new Date(),
            note: dto.note?.trim() ? dto.note.trim() : null,
            recordedById: userId,
        });
        const saved = await this.attendanceRepository.save(attendance);
        // Fresh check-in must be visible to the owner dashboard immediately.
        await cache_util_1.cacheService.invalidatePattern('attendance:list');
        await cache_util_1.cacheService.invalidatePattern('attendance:resident');
        return saved;
    }
    /**
     * Resident self check-out for today (Nepal date). Closes today's check-in.
     */
    async checkOut(userId) {
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
        existing.checkOutAt = new Date();
        const saved = await this.attendanceRepository.save(existing);
        await cache_util_1.cacheService.invalidatePattern('attendance:list');
        await cache_util_1.cacheService.invalidatePattern('attendance:resident');
        return saved;
    }
    /** Resident's own attendance history, newest first. */
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
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return (0, pagination_util_1.createPaginatedResponse)(wrapped.data.rows, wrapped.data.total, { page, limit }, { isCached: wrapped.isCached, cacheLevel: wrapped.cacheLevel });
    }
}
exports.AttendanceService = AttendanceService;
