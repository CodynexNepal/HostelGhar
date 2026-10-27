"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportRepository = void 0;
// ─────────────────────────────────────────────────────────────
// FILE: report.repository.ts
// PURPOSE: Owner-scoped data access for Reports (rooms/beds/fees/proofs).
//          TypeORM stays here; grouping/exports live in the service.
// ─────────────────────────────────────────────────────────────
const typeorm_1 = require("typeorm");
const database_source_1 = require("../../database/database-source");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const room_entity_1 = require("../../entities/room/room.entity");
const bed_entity_1 = require("../../entities/bed/bed.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const fee_entity_1 = require("../../entities/fee/fee.entity");
const payment_proof_entity_1 = require("../../entities/payment-proof/payment-proof.entity");
const payment_proof_enum_1 = require("../../enum/payment-proof.enum");
const fee_enum_1 = require("../../enum/fee.enum");
class ReportRepository {
    constructor() {
        this.hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        this.roomRepo = database_source_1.AppDataSource.getRepository(room_entity_1.Room);
        this.bedRepo = database_source_1.AppDataSource.getRepository(bed_entity_1.Bed);
        this.residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        this.feeRepo = database_source_1.AppDataSource.getRepository(fee_entity_1.Fee);
        this.proofRepo = database_source_1.AppDataSource.getRepository(payment_proof_entity_1.PaymentProof);
    }
    /** Hostels visible to the requester. Owners: only theirs. Admins: all. */
    async findScopedHostels(requester, hostelId) {
        const isAdmin = requester.role === 'admin';
        if (hostelId) {
            const hostel = await this.hostelRepo.findOne({ where: { id: hostelId } });
            if (!hostel)
                return [];
            if (!isAdmin && hostel.ownerId !== requester.userId)
                return [];
            return [hostel];
        }
        if (isAdmin) {
            return this.hostelRepo.find({ order: { name: 'ASC' } });
        }
        return this.hostelRepo.find({
            where: { ownerId: requester.userId },
            order: { name: 'ASC' },
        });
    }
    async findRoomsByHostels(hostelIds) {
        if (hostelIds.length === 0)
            return [];
        return this.roomRepo.find({
            where: { hostelId: (0, typeorm_1.In)(hostelIds) },
            relations: { hostel: true },
            order: { roomNumber: 'ASC' },
        });
    }
    async findBedsByHostels(hostelIds) {
        if (hostelIds.length === 0)
            return [];
        return this.bedRepo.find({
            where: { hostelId: (0, typeorm_1.In)(hostelIds) },
            relations: { room: true },
            order: { bedNumber: 'ASC' },
        });
    }
    async findResidentsByHostels(hostelIds) {
        if (hostelIds.length === 0)
            return [];
        return this.residentRepo.find({
            where: { hostelId: (0, typeorm_1.In)(hostelIds), isActive: true },
            relations: { user: true, hostel: true },
            order: { roomNumber: 'ASC' },
        });
    }
    async findFeesByHostels(hostelIds) {
        if (hostelIds.length === 0)
            return [];
        return this.feeRepo.find({
            where: { hostelId: (0, typeorm_1.In)(hostelIds) },
            relations: { resident: { user: true }, hostel: true },
            order: { billingYear: 'DESC', billingMonth: 'DESC' },
        });
    }
    async findOutstandingFeesByHostels(hostelIds) {
        if (hostelIds.length === 0)
            return [];
        return this.feeRepo.find({
            where: {
                hostelId: (0, typeorm_1.In)(hostelIds),
                status: (0, typeorm_1.In)([fee_enum_1.FeeStatus.PENDING, fee_enum_1.FeeStatus.OVERDUE, fee_enum_1.FeeStatus.PARTIALLY_PAID]),
            },
            relations: { resident: { user: true }, hostel: true },
            order: { dueDate: 'ASC' },
        });
    }
    async findApprovedProofsByHostels(hostelIds) {
        if (hostelIds.length === 0)
            return [];
        return this.proofRepo.find({
            where: { hostelId: (0, typeorm_1.In)(hostelIds), status: payment_proof_enum_1.PaymentProofStatus.APPROVED },
            relations: { resident: { user: true }, fee: true, hostel: true },
            order: { createdAt: 'ASC' },
        });
    }
}
exports.ReportRepository = ReportRepository;
