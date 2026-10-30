"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.repository.ts
// PURPOSE: Data access layer for notifications and unread counter aggregations.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRepository = void 0;
const database_source_1 = require("../../database/database-source");
const notification_entity_1 = require("../../entities/notification/notification.entity");
class NotificationRepository {
    constructor() {
        this.repo = database_source_1.AppDataSource.getRepository(notification_entity_1.Notification);
    }
    async createNotification(data) {
        const notification = this.repo.create({
            userId: data.userId,
            hostelId: data.hostelId || null,
            type: data.type,
            title: data.title,
            message: data.message,
            entityType: data.entityType,
            entityId: data.entityId || null,
            targetUrl: data.targetUrl || null,
            metadata: data.metadata || null,
            isRead: false,
            readAt: null,
        });
        return await this.repo.save(notification);
    }
    async findById(id) {
        return await this.repo.findOne({ where: { id } });
    }
    async findByUser(userId, page = 1, limit = 20, isRead, entityType, hostelId) {
        const query = this.repo
            .createQueryBuilder('n')
            .where('n.userId = :userId', { userId });
        if (hostelId) {
            query.andWhere('(n.hostelId = :hostelId OR n.hostelId IS NULL)', { hostelId });
        }
        if (typeof isRead === 'boolean') {
            query.andWhere('n.isRead = :isRead', { isRead });
        }
        if (entityType && entityType.trim() !== '') {
            query.andWhere('n.entityType = :entityType', { entityType: entityType.trim() });
        }
        query
            .orderBy('n.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        return await query.getManyAndCount();
    }
    async countUnreadByUser(userId, hostelId) {
        const query = this.repo
            .createQueryBuilder('n')
            .where('n.userId = :userId', { userId })
            .andWhere('n.isRead = :isRead', { isRead: false });
        if (hostelId) {
            query.andWhere('(n.hostelId = :hostelId OR n.hostelId IS NULL)', { hostelId });
        }
        return await query.getCount();
    }
    async countUnreadByCategory(userId, hostelId) {
        const query = this.repo
            .createQueryBuilder('n')
            .select('n.entityType', 'category')
            .addSelect('COUNT(n.id)', 'count')
            .where('n.userId = :userId', { userId })
            .andWhere('n.isRead = :isRead', { isRead: false });
        if (hostelId) {
            query.andWhere('(n.hostelId = :hostelId OR n.hostelId IS NULL)', { hostelId });
        }
        query.groupBy('n.entityType');
        const results = await query.getRawMany();
        const byCategory = {
            booking: 0,
            bookings: 0,
            resident: 0,
            residents: 0,
            payment: 0,
            payments: 0,
            complaint: 0,
            complaints: 0,
            hostel: 0,
            hostels: 0,
            user: 0,
            users: 0,
            subscription: 0,
            subscriptions: 0,
            meal: 0,
            meals: 0,
            announcement: 0,
            announcements: 0,
            system: 0,
        };
        let total = 0;
        for (const row of results) {
            const cat = String(row.category || '').toLowerCase();
            const count = Math.max(0, parseInt(row.count, 10) || 0);
            total += count;
            byCategory[cat] = count;
            // Also provide plural alias for convenient frontend matching
            if (!cat.endsWith('s')) {
                byCategory[`${cat}s`] = count;
            }
            else {
                byCategory[cat.slice(0, -1)] = count;
            }
        }
        return { total, byCategory };
    }
    async markAsRead(notificationId, userId) {
        const notification = await this.repo.findOne({
            where: { id: notificationId, userId },
        });
        if (!notification)
            return null;
        if (!notification.isRead) {
            notification.isRead = true;
            notification.readAt = new Date();
            return await this.repo.save(notification);
        }
        return notification;
    }
    async markAllAsRead(userId, entityType, hostelId) {
        const query = this.repo
            .createQueryBuilder()
            .update(notification_entity_1.Notification)
            .set({ isRead: true, readAt: new Date() })
            .where('userId = :userId', { userId })
            .andWhere('isRead = :isRead', { isRead: false });
        if (entityType && entityType.trim() !== '') {
            // Support matching either singular or plural (e.g. 'booking' or 'bookings')
            const singular = entityType.trim().toLowerCase().replace(/s$/, '');
            const plural = `${singular}s`;
            query.andWhere('entityType IN (:...types)', { types: [singular, plural, entityType.trim()] });
        }
        if (hostelId) {
            query.andWhere('(hostelId = :hostelId OR hostelId IS NULL)', { hostelId });
        }
        const result = await query.execute();
        return result.affected || 0;
    }
    async deleteNotification(notificationId, userId) {
        const result = await this.repo.delete({ id: notificationId, userId });
        return (result.affected ?? 0) > 0;
    }
}
exports.NotificationRepository = NotificationRepository;
