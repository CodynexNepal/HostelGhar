"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: staff.repository.ts
// PURPOSE: Data access for hostel staff with hostel scoping + pagination.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffRepository = void 0;
const database_source_1 = require("../../database/database-source");
const staff_entity_1 = require("../../entities/staff/staff.entity");
class StaffRepository {
    constructor() {
        this.staffRepo = database_source_1.AppDataSource.getRepository(staff_entity_1.Staff);
    }
    create(data) {
        return this.staffRepo.create(data);
    }
    save(staff) {
        return this.staffRepo.save(staff);
    }
    findById(id) {
        return this.staffRepo.findOne({ where: { id }, relations: { hostel: true } });
    }
    findPage(filters, page, limit) {
        const query = this.applyFilters(this.staffRepo.createQueryBuilder('staff'), filters);
        return query
            .leftJoinAndSelect('staff.hostel', 'hostel')
            .orderBy('staff.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();
    }
    remove(staff) {
        return this.staffRepo.remove(staff);
    }
    applyFilters(query, { hostelId, hostelIds, role, shift, status, search }) {
        if (hostelId)
            query.andWhere('staff.hostelId = :hostelId', { hostelId });
        else if (hostelIds) {
            if (hostelIds.length === 0)
                query.andWhere('1 = 0');
            else
                query.andWhere('staff.hostelId IN (:...hostelIds)', { hostelIds });
        }
        if (role)
            query.andWhere('staff.role = :role', { role });
        if (shift)
            query.andWhere('staff.shift = :shift', { shift });
        if (status)
            query.andWhere('staff.status = :status', { status });
        if (search) {
            query.andWhere('(staff.fullName ILIKE :search OR staff.phone ILIKE :search)', {
                search: `%${search}%`,
            });
        }
        return query;
    }
}
exports.StaffRepository = StaffRepository;
