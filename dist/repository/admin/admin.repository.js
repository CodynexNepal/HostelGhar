"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.repository.ts
// PURPOSE: Data access layer for Admin operations on Hostels and Users.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRepository = void 0;
const typeorm_1 = require("typeorm");
const database_source_1 = require("../../database/database-source");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const user_entity_1 = require("../../entities/user.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
class AdminRepository {
    constructor() {
        this.hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        this.userRepo = database_source_1.AppDataSource.getRepository(user_entity_1.User);
        this.residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
    }
    // ─── 1. Persist contact/location info sent by the admin form ──────────────
    // dto.city/address/phone/email are whitelisted by CreateHostelDto; the
    // entity columns are nullable so old rows without them keep working.
    async createHostel(hostelData) {
        const hostel = this.hostelRepo.create({
            name: hostelData.name,
            type: hostelData.type,
            city: hostelData.city ?? null,
            address: hostelData.address ?? null,
            phone: hostelData.phone ?? null,
            email: hostelData.email ?? null,
            ownerId: hostelData.ownerId,
            createdByAdminId: hostelData.createdByAdminId,
        });
        return await this.hostelRepo.save(hostel);
    }
    async findHostelsWithPagination(page, limit) {
        return await this.hostelRepo.findAndCount({
            relations: {
                owner: true,
                createdByAdmin: true,
            },
            select: {
                id: true,
                name: true,
                type: true,
                city: true,
                address: true,
                phone: true,
                email: true,
                logoUrl: true,
                isActive: true,
                suspendedAt: true,
                suspendReason: true,
                ownerId: false,
                createdByAdminId: false,
                createdAt: true,
                updatedAt: true,
                createdByAdmin: { id: true, firstName: true, lastName: true, email: true },
                owner: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    avatarUrl: true,
                },
            },
            skip: (page - 1) * limit,
            take: limit,
            order: { createdAt: 'DESC' },
        });
    }
    async countHostels() {
        return await this.hostelRepo.count();
    }
    async countExistingHostels(ids) {
        if (ids.length === 0)
            return 0;
        return await this.hostelRepo.count({ where: { id: (0, typeorm_1.In)(ids) } });
    }
    async findUserById(id) {
        return await this.userRepo.findOne({ where: { id } });
    }
    /**
     * Counts ACTIVE residents per hostel in ONE query (no N+1).
     * Returns Map<hostelId, activeResidentCount>. Empty input → empty map.
     */
    async countActiveResidentsByHostel(hostelIds) {
        if (hostelIds.length === 0)
            return new Map();
        const rows = await this.residentRepo
            .createQueryBuilder('r')
            .select('r.hostelId', 'hostelId')
            .addSelect('COUNT(r.id)', 'cnt')
            .where('r.hostelId IN (:...hostelIds)', { hostelIds })
            .andWhere('r.isActive = :isActive', { isActive: true })
            .groupBy('r.hostelId')
            .getRawMany();
        return new Map(rows.map((r) => [r.hostelId, Number(r.cnt)]));
    }
    async getHostelOccupancyByHostel(hostelIds) {
        if (hostelIds.length === 0)
            return new Map();
        const rows = await this.residentRepo
            .createQueryBuilder('r')
            .select('r.hostelId', 'hostelId')
            .addSelect('COUNT(DISTINCT r.roomNumber)', 'rooms')
            .addSelect('COUNT(DISTINCT r.bedNumber)', 'beds')
            .addSelect('COUNT(r.id)', 'occupied')
            .where('r.hostelId IN (:...hostelIds)', { hostelIds })
            .andWhere('r.isActive = :isActive', { isActive: true })
            .groupBy('r.hostelId')
            .getRawMany();
        return new Map(rows.map((row) => [
            row.hostelId,
            {
                rooms: Number(row.rooms),
                beds: Number(row.beds),
                occupied: Number(row.occupied),
            },
        ]));
    }
    async findHostelById(id) {
        return await this.hostelRepo.findOne({
            where: { id },
            relations: { owner: true },
        });
    }
    async saveHostel(hostel) {
        return this.hostelRepo.save(hostel);
    }
}
exports.AdminRepository = AdminRepository;
