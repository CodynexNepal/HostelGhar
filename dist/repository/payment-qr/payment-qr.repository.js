"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.repository.ts
// PURPOSE: Data access layer for Hostel Payment QR Codes (TypeORM).
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentQrRepository = void 0;
const database_source_1 = require("../../database/database-source");
const payment_qr_entity_1 = require("../../entities/payment-qr/payment-qr.entity");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
class PaymentQrRepository {
    constructor() {
        this.qrRepo = database_source_1.AppDataSource.getRepository(payment_qr_entity_1.PaymentQr);
        this.hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        this.residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
    }
    create(data) {
        return this.qrRepo.create(data);
    }
    async save(paymentQr) {
        return this.qrRepo.save(paymentQr);
    }
    async findById(id) {
        return this.qrRepo.findOne({
            where: { id },
            relations: { hostel: true },
        });
    }
    async findByHostel(hostelId, options) {
        return this.qrRepo.find({
            where: {
                hostelId,
                ...(options?.onlyActive !== undefined ? { isActive: options.onlyActive } : {}),
            },
            order: {
                paymentMethod: 'ASC',
                createdAt: 'ASC',
            },
        });
    }
    async findByHostelAndMethod(hostelId, paymentMethod) {
        return this.qrRepo.findOne({
            where: {
                hostelId,
                paymentMethod,
            },
        });
    }
    async delete(id) {
        return this.qrRepo.delete(id);
    }
    async findHostelById(hostelId) {
        return this.hostelRepo.findOne({
            where: { id: hostelId },
        });
    }
    async findHostelsByOwner(ownerId) {
        return this.hostelRepo.find({
            where: { ownerId },
            order: { name: 'ASC' },
        });
    }
    async findResidentByUserId(userId) {
        return this.residentRepo.findOne({
            where: { userId, isActive: true },
            relations: { hostel: true },
        });
    }
}
exports.PaymentQrRepository = PaymentQrRepository;
