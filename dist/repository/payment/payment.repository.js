"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.repository.ts
// PURPOSE: Data access operations for payments, partial settlements, and audit logs.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRepository = void 0;
const database_source_1 = require("../../database/database-source");
const payment_entity_1 = require("../../entities/payment/payment.entity");
class PaymentRepository {
    constructor() {
        this.paymentRepo = database_source_1.AppDataSource.getRepository(payment_entity_1.Payment);
    }
    async findById(id) {
        return this.paymentRepo.findOne({
            where: { id },
            relations: {
                fee: true,
                resident: { user: true },
                hostel: { owner: true },
                receivedByUser: true,
            },
        });
    }
    async findByIdempotencyKey(idempotencyKey) {
        return this.paymentRepo.findOne({
            where: { idempotencyKey },
            relations: {
                fee: true,
                resident: { user: true },
            },
        });
    }
    async findByTransactionReference(transactionReference, invoiceId) {
        const where = { transactionReference };
        if (invoiceId) {
            where.invoiceId = invoiceId;
        }
        return this.paymentRepo.findOne({
            where,
            relations: {
                fee: true,
                resident: { user: true },
            },
        });
    }
    async findByInvoice(invoiceId) {
        return this.paymentRepo.find({
            where: { invoiceId },
            relations: {
                receivedByUser: true,
            },
            order: { paidAt: 'DESC' },
        });
    }
    async findByResident(residentId, page = 1, limit = 20) {
        return this.paymentRepo.findAndCount({
            where: { residentId },
            relations: {
                fee: true,
                hostel: true,
            },
            order: { paidAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
    async findByHostel(hostelId, page = 1, limit = 20, filters = {}) {
        const qb = this.paymentRepo
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.fee', 'fee')
            .leftJoinAndSelect('p.resident', 'resident')
            .leftJoinAndSelect('resident.user', 'user')
            .leftJoinAndSelect('p.receivedByUser', 'receivedByUser')
            .where('p.hostelId = :hostelId', { hostelId });
        if (filters.status) {
            qb.andWhere('p.paymentStatus = :status', { status: filters.status });
        }
        if (filters.paymentMethod) {
            qb.andWhere('p.paymentMethod = :method', { method: filters.paymentMethod });
        }
        if (filters.startDate) {
            qb.andWhere('p.paidAt >= :startDate', { startDate: filters.startDate });
        }
        if (filters.endDate) {
            qb.andWhere('p.paidAt <= :endDate', { endDate: filters.endDate });
        }
        if (filters.search?.trim()) {
            const term = `%${filters.search.trim().toLowerCase()}%`;
            qb.andWhere('(LOWER(user.firstName) LIKE :term OR LOWER(user.lastName) LIKE :term OR LOWER(resident.roomNumber) LIKE :term OR LOWER(p.transactionReference) LIKE :term OR LOWER(p.receiptNumber) LIKE :term)', { term });
        }
        qb.orderBy('p.paidAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        return qb.getManyAndCount();
    }
    async createPayment(data, manager) {
        const repo = manager ? manager.getRepository(payment_entity_1.Payment) : this.paymentRepo;
        const entity = repo.create(data);
        return repo.save(entity);
    }
}
exports.PaymentRepository = PaymentRepository;
