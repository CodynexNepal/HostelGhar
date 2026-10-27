"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident-import.repository.ts
// PURPOSE: Data access for ResidentImport history rows (owner-scoped, paginated).
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResidentImportRepository = void 0;
const database_source_1 = require("../../database/database-source");
const resident_import_entity_1 = require("../../entities/import/resident-import.entity");
class ResidentImportRepository {
    constructor() {
        this.importRepo = database_source_1.AppDataSource.getRepository(resident_import_entity_1.ResidentImport);
    }
    create(data) {
        return this.importRepo.create(data);
    }
    async save(record) {
        return await this.importRepo.save(record);
    }
    async findById(id) {
        return await this.importRepo.findOne({ where: { id } });
    }
    async findByIdempotency(hostelId, requestedBy, idempotencyKey) {
        return await this.importRepo.findOne({
            where: { hostelId, requestedBy, idempotencyKey },
            order: { createdAt: 'DESC' },
        });
    }
    async countActiveToday(requestedBy) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        return await this.importRepo
            .createQueryBuilder('ri')
            .where('ri.requestedBy = :requestedBy', { requestedBy })
            .andWhere('ri.createdAt >= :startOfDay', { startOfDay })
            .andWhere('ri.status IN (:...statuses)', {
            statuses: [resident_import_entity_1.ResidentImportStatus.QUEUED, resident_import_entity_1.ResidentImportStatus.PROCESSING],
        })
            .getCount();
    }
    async findHistoryByOwner(ownerId, page, limit, hostelId) {
        const qb = this.importRepo
            .createQueryBuilder('ri')
            .leftJoinAndSelect('ri.hostel', 'hostel')
            .where('ri.requestedBy = :ownerId', { ownerId })
            .orderBy('ri.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        if (hostelId) {
            qb.andWhere('ri.hostelId = :hostelId', { hostelId });
        }
        return await qb.getManyAndCount();
    }
    async findHistoryByHostel(hostelId, page, limit) {
        return await this.importRepo.findAndCount({
            where: { hostelId },
            order: { createdAt: 'DESC' },
            relations: { hostel: true },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
}
exports.ResidentImportRepository = ResidentImportRepository;
