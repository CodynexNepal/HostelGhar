"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident.repository.ts
// PURPOSE: Data access layer for Resident operations on Leaves, Fees, and Profiles.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResidentRepository = void 0;
const database_source_1 = require("../../database/database-source");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const leave_request_entity_1 = require("../../entities/leave/leave-request.entity");
const leave_type_entity_1 = require("../../entities/leave/leave-type.entity");
const fee_entity_1 = require("../../entities/fee/fee.entity");
const room_entity_1 = require("../../entities/room/room.entity");
const hostel_facility_entity_1 = require("../../entities/facility/hostel-facility.entity");
class ResidentRepository {
    constructor() {
        this.residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        this.leaveRepo = database_source_1.AppDataSource.getRepository(leave_request_entity_1.LeaveRequest);
        this.leaveTypeRepo = database_source_1.AppDataSource.getRepository(leave_type_entity_1.LeaveType);
        this.feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
        this.roomRepo = database_source_1.AppDataSource.getRepository(room_entity_1.Room);
        this.hostelFacilityRepo = database_source_1.AppDataSource.getRepository(hostel_facility_entity_1.HostelFacility);
    }
    async findResidentByUserId(userId) {
        return await this.residentRepo.findOne({
            where: { userId, isActive: true },
            relations: { hostel: true, user: true },
        });
    }
    async saveResident(resident) {
        return await this.residentRepo.save(resident);
    }
    async findLeaveTypeById(leaveTypeId) {
        return await this.leaveTypeRepo.findOne({ where: { id: leaveTypeId } });
    }
    async createLeaveRequest(data) {
        const leave = this.leaveRepo.create(data);
        return await this.leaveRepo.save(leave);
    }
    async findLeavesByResident(residentId, page, limit) {
        return await this.leaveRepo.findAndCount({
            where: { residentId },
            relations: { leaveType: true },
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
    async findFeesByResident(residentId) {
        return await this.feeRepo.find({
            where: { residentId },
            order: { billingYear: 'DESC', billingMonth: 'DESC' },
        });
    }
    /**
     * Room inventory row for THIS resident's assignment, matched by
     * (hostelId, roomNumber) since residents store roomNumber as plain text.
     * Returns null when owner hasn't created that Room row yet.
     */
    async findRoomForResident(hostelId, roomNumber) {
        const roomNo = roomNumber?.trim();
        if (!hostelId || !roomNo)
            return null;
        return await this.roomRepo.findOne({
            where: { hostelId, roomNumber: roomNo },
        });
    }
    /**
     * Facilities shown on resident "Facilities at <hostel>" card.
     * Same source as GET /hostels/:hostelId/facilities, but called from a
     * resident-scoped endpoint so residents never hit owner/admin-only routes.
     */
    async findFacilitiesByHostel(hostelId) {
        return await this.hostelFacilityRepo.find({
            where: { hostelId },
            relations: { facility: true },
            order: { createdAt: 'ASC' },
        });
    }
}
exports.ResidentRepository = ResidentRepository;
