"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.repository.ts
// PURPOSE: Data access layer for platform checkout QRs (one row per method).
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformQrRepository = void 0;
const database_source_1 = require("../../database/database-source");
const platform_qr_entity_1 = require("../../entities/platform-qr/platform-qr.entity");
class PlatformQrRepository {
    get repo() {
        return database_source_1.AppDataSource.getRepository(platform_qr_entity_1.PlatformQr);
    }
    async findAll(options) {
        return this.repo.find({
            where: options?.onlyActive !== undefined ? { isActive: options.onlyActive } : {},
            order: { method: 'ASC', createdAt: 'ASC' },
        });
    }
    async findById(id) {
        return this.repo.findOne({ where: { id } });
    }
    async findByMethod(method) {
        return this.repo.findOne({ where: { method } });
    }
    create(data) {
        return this.repo.create(data);
    }
    async save(platformQr) {
        return this.repo.save(platformQr);
    }
    async delete(id) {
        return this.repo.delete(id);
    }
}
exports.PlatformQrRepository = PlatformQrRepository;
