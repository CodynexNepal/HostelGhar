"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.repository.ts
// PURPOSE: Data access layer for subscriptions, plan querying, and limit checks.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionRepository = void 0;
const database_source_1 = require("../../database/database-source");
const subscription_entity_1 = require("../../entities/subscription/subscription.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const subscription_enum_1 = require("../../enum/subscription.enum");
class SubscriptionRepository {
    constructor() {
        this.subRepo = database_source_1.AppDataSource.getRepository(subscription_entity_1.Subscription);
        this.residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        this.hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
    }
    create(data) {
        return this.subRepo.create(data);
    }
    async save(subscription) {
        return this.subRepo.save(subscription);
    }
    async findById(id) {
        return this.subRepo.findOne({
            where: { id },
            relations: { owner: true, hostel: true },
        });
    }
    /**
     * Finds the latest active subscription for an owner (or hostel).
     */
    async findActiveSubscription(params) {
        const qb = this.subRepo
            .createQueryBuilder('sub')
            .leftJoinAndSelect('sub.hostel', 'hostel')
            .where('sub.status = :status', { status: subscription_enum_1.SubscriptionStatus.ACTIVE })
            .andWhere('(sub.endDate IS NULL OR sub.endDate >= NOW())');
        if (params.hostelId && params.ownerId) {
            qb.andWhere('(sub.hostelId = :hostelId OR sub.ownerId = :ownerId)', {
                hostelId: params.hostelId,
                ownerId: params.ownerId,
            });
        }
        else if (params.hostelId) {
            qb.andWhere('sub.hostelId = :hostelId', { hostelId: params.hostelId });
        }
        else if (params.ownerId) {
            qb.andWhere('sub.ownerId = :ownerId', { ownerId: params.ownerId });
        }
        else {
            return null;
        }
        qb.orderBy('sub.createdAt', 'DESC');
        return qb.getOne();
    }
    /**
     * Retrieves all subscription records for an owner.
     */
    async findByOwner(ownerId) {
        return this.subRepo.find({
            where: { ownerId },
            relations: { hostel: true },
            order: { createdAt: 'DESC' },
        });
    }
    /**
     * Cancels/deactivates existing active subscriptions when an owner upgrades or cancels.
     */
    async deactivateExistingActive(ownerId, hostelId) {
        const qb = this.subRepo
            .createQueryBuilder()
            .update(subscription_entity_1.Subscription)
            .set({
            status: subscription_enum_1.SubscriptionStatus.EXPIRED,
            cancelledAt: new Date(),
            updatedAt: new Date(),
        })
            .where('ownerId = :ownerId', { ownerId })
            .andWhere('status = :status', { status: subscription_enum_1.SubscriptionStatus.ACTIVE });
        if (hostelId) {
            qb.andWhere('(hostelId = :hostelId OR hostelId IS NULL)', { hostelId });
        }
        await qb.execute();
    }
    /**
     * Counts currently active residents in a hostel.
     */
    async countActiveResidents(hostelId) {
        return this.residentRepo.count({
            where: { hostelId, isActive: true },
        });
    }
    /**
     * Counts total hostels owned by an owner.
     */
    async countOwnerHostels(ownerId) {
        return this.hostelRepo.count({
            where: { ownerId },
        });
    }
    /**
     * Finds hostel by ID.
     */
    async findHostelById(hostelId) {
        return this.hostelRepo.findOne({
            where: { id: hostelId },
        });
    }
    /**
     * Latest PENDING request (payment proof awaiting admin review) for an
     * owner + hostel. Used to block duplicate upgrade requests.
     */
    async findPendingRequest(ownerId, hostelId) {
        return this.subRepo.findOne({
            where: hostelId
                ? { ownerId, status: subscription_enum_1.SubscriptionStatus.PENDING, hostelId }
                : { ownerId, status: subscription_enum_1.SubscriptionStatus.PENDING },
            order: { createdAt: 'DESC' },
        });
    }
    /**
     * Admin review queue: PENDING (or filtered) subscription requests, newest
     * first, with owner + hostel denormalized for the dashboard table.
     */
    async listRequests(options) {
        const where = {};
        if (options.status)
            where.status = options.status;
        const [rows, total] = await this.subRepo.findAndCount({
            where,
            relations: { owner: true, hostel: true, reviewedByUser: true },
            order: { createdAt: 'DESC' },
            skip: (options.page - 1) * options.limit,
            take: options.limit,
        });
        return { rows, total };
    }
}
exports.SubscriptionRepository = SubscriptionRepository;
