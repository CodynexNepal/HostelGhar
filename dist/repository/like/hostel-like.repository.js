"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostelLikeRepository = void 0;
const database_source_1 = require("../../database/database-source");
const hostel_like_entity_1 = require("../../entities/like/hostel-like.entity");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
class HostelLikeRepository {
    constructor() {
        this.repo = database_source_1.AppDataSource.getRepository(hostel_like_entity_1.HostelLike);
        this.hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
    }
    async toggleLike(hostelId, clientIdentifier, userId = null, ipAddress = null) {
        // Check if like exists for this hostel and client/user
        const query = this.repo
            .createQueryBuilder('like')
            .where('like.hostelId = :hostelId', { hostelId });
        if (userId) {
            query.andWhere('(like.userId = :userId OR like.clientIdentifier = :clientIdentifier)', {
                userId,
                clientIdentifier,
            });
        }
        else {
            query.andWhere('like.clientIdentifier = :clientIdentifier', { clientIdentifier });
        }
        const existing = await query.getOne();
        if (existing) {
            await this.repo.remove(existing);
            const likeCount = await this.repo.count({ where: { hostelId } });
            return { liked: false, likeCount };
        }
        const newLike = this.repo.create({
            hostelId,
            clientIdentifier,
            userId: userId || null,
            ipAddress: ipAddress || null,
        });
        await this.repo.save(newLike);
        const likeCount = await this.repo.count({ where: { hostelId } });
        return { liked: true, likeCount };
    }
    async getUserLikedHostelIds(clientIdentifier, userId = null) {
        const qb = this.repo
            .createQueryBuilder('like')
            .select('like.hostelId', 'hostelId')
            .distinct(true);
        if (userId) {
            qb.where('like.userId = :userId OR like.clientIdentifier = :clientIdentifier', {
                userId,
                clientIdentifier,
            });
        }
        else {
            qb.where('like.clientIdentifier = :clientIdentifier', { clientIdentifier });
        }
        const rows = await qb.getRawMany();
        return rows.map((r) => r.hostelId);
    }
    async getUserLikedHostels(clientIdentifier, userId = null) {
        const hostelIds = await this.getUserLikedHostelIds(clientIdentifier, userId);
        if (!hostelIds.length) {
            return [];
        }
        const hostels = await this.hostelRepo
            .createQueryBuilder('hostel')
            .leftJoinAndSelect('hostel.hostelFacilities', 'hostelFacility')
            .leftJoinAndSelect('hostelFacility.facility', 'facility')
            .where('hostel.id IN (:...hostelIds)', { hostelIds })
            .getMany();
        return hostels.map((h) => ({
            id: h.id,
            name: h.name,
            type: h.type,
            city: h.city,
            address: h.address,
            phone: h.phone,
            email: h.email,
            logoUrl: h.logoUrl,
            facilities: h.hostelFacilities?.map((hf) => hf.facility?.title).filter(Boolean) || [],
        }));
    }
    async getHostelLikeCount(hostelId) {
        return await this.repo.count({ where: { hostelId } });
    }
    async isHostelLiked(hostelId, clientIdentifier, userId = null) {
        const qb = this.repo
            .createQueryBuilder('like')
            .where('like.hostelId = :hostelId', { hostelId });
        if (userId) {
            qb.andWhere('(like.userId = :userId OR like.clientIdentifier = :clientIdentifier)', {
                userId,
                clientIdentifier,
            });
        }
        else {
            qb.andWhere('like.clientIdentifier = :clientIdentifier', { clientIdentifier });
        }
        const count = await qb.getCount();
        return count > 0;
    }
}
exports.HostelLikeRepository = HostelLikeRepository;
