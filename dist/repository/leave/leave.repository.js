"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveRepository = void 0;
const database_source_1 = require("../../database/database-source");
const leave_request_entity_1 = require("../../entities/leave/leave-request.entity");
class LeaveRepository {
    constructor() {
        this.leaveRepo = database_source_1.AppDataSource.getRepository(leave_request_entity_1.LeaveRequest);
    }
    async findByHostel(hostelId, status, page = 1, limit = 20) {
        return this.leaveRepo.findAndCount({
            where: {
                resident: { hostelId },
                ...(status ? { status } : {}),
            },
            relations: { resident: { user: true }, leaveType: true },
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
    async findById(id) {
        return this.leaveRepo.findOne({
            where: { id },
            relations: { resident: { user: true, hostel: true }, leaveType: true },
        });
    }
    async save(leave) {
        return this.leaveRepo.save(leave);
    }
}
exports.LeaveRepository = LeaveRepository;
