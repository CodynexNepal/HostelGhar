"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.repository.ts
// PURPOSE: Data access for daily resident attendance with hostel scoping,
//          pagination, and resident-name joins for the owner dashboard.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceRepository = void 0;
const database_source_1 = require("../../database/database-source");
const attendance_entity_1 = require("../../entities/attendance/attendance.entity");
class AttendanceRepository {
    constructor() {
        this.attendanceRepo = database_source_1.AppDataSource.getRepository(attendance_entity_1.Attendance);
    }
    create(data) {
        return this.attendanceRepo.create(data);
    }
    save(attendance) {
        return this.attendanceRepo.save(attendance);
    }
    findByResidentAndDate(residentId, date) {
        return this.attendanceRepo.findOne({ where: { residentId, date } });
    }
    /**
     * Paginated list joined with resident + user so the owner dashboard can
     * render names without a second query. Password columns are excluded by
     * explicit select — never rely on entity-wide default selects here.
     */
    findPage(filters, page, limit) {
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
    applyFilters(query, { hostelId, hostelIds, residentId, date, status }) {
        if (hostelId)
            query.andWhere('attendance.hostelId = :hostelId', { hostelId });
        else if (hostelIds) {
            if (hostelIds.length === 0)
                query.andWhere('1 = 0');
            else
                query.andWhere('attendance.hostelId IN (:...hostelIds)', { hostelIds });
        }
        if (residentId)
            query.andWhere('attendance.residentId = :residentId', { residentId });
        if (date)
            query.andWhere('attendance.date = :date', { date });
        if (status)
            query.andWhere('attendance.status = :status', { status });
        return query;
    }
}
exports.AttendanceRepository = AttendanceRepository;
