"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.service.ts
// PURPOSE: Business logic for notifications, unread tracking, and real-time Socket.io delivery.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.notificationRepository = exports.NotificationService = void 0;
const notification_repository_1 = require("../../repository/notification/notification.repository");
const socket_server_1 = require("../../socket/socket.server");
const queue_constants_1 = require("../../constant/queue.constants");
const database_source_1 = require("../../database/database-source");
const user_entity_1 = require("../../entities/user.entity");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const enum_constant_1 = require("../../constant/enum.constant");
const logger_1 = require("../../observability/logger");
class NotificationService {
    constructor(notificationRepo) {
        this.notificationRepo = notificationRepo;
    }
    async getNotifications(userId, page = 1, limit = 20, isRead, entityType, hostelId) {
        const [items, total] = await this.notificationRepo.findByUser(userId, page, limit, isRead, entityType, hostelId);
        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1,
        };
    }
    async getUnreadCount(userId, hostelId) {
        const count = await this.notificationRepo.countUnreadByUser(userId, hostelId);
        return { count };
    }
    async getUnreadCounts(userId, hostelId) {
        return await this.notificationRepo.countUnreadByCategory(userId, hostelId);
    }
    async markAsRead(notificationId, userId) {
        const notification = await this.notificationRepo.markAsRead(notificationId, userId);
        if (notification) {
            // Broadcast updated counts to user
            const counts = await this.notificationRepo.countUnreadByCategory(userId, notification.hostelId || undefined);
            socket_server_1.socketServer.toUser(userId, 'notification:counts', counts);
        }
        return notification;
    }
    async markAllAsRead(userId, entityType, hostelId) {
        const updatedCount = await this.notificationRepo.markAllAsRead(userId, entityType, hostelId);
        // Broadcast updated counts to user
        const counts = await this.notificationRepo.countUnreadByCategory(userId, hostelId);
        socket_server_1.socketServer.toUser(userId, 'notification:counts', counts);
        return { updatedCount, counts };
    }
    async deleteNotification(notificationId, userId) {
        const deleted = await this.notificationRepo.deleteNotification(notificationId, userId);
        if (deleted) {
            const counts = await this.notificationRepo.countUnreadByCategory(userId);
            socket_server_1.socketServer.toUser(userId, 'notification:counts', counts);
        }
        return deleted;
    }
    /**
     * Primary entry point for creating notifications across the system.
     * Persists to PostgreSQL first, then broadcasts via Socket.io.
     */
    async createNotification(data) {
        try {
            const notification = await this.notificationRepo.createNotification(data);
            // Fetch fresh category unread counts for recipient
            const counts = await this.notificationRepo.countUnreadByCategory(data.userId, data.hostelId || undefined);
            // Realtime broadcast to specific user room: 'user:<userId>'
            socket_server_1.socketServer.toUser(data.userId, queue_constants_1.SocketEvent.NOTIFICATION_RECEIVED, notification);
            socket_server_1.socketServer.toUser(data.userId, 'notification:new', notification);
            socket_server_1.socketServer.toUser(data.userId, 'notification:counts', counts);
            return notification;
        }
        catch (err) {
            logger_1.logger.error('Failed to create and dispatch notification', {
                userId: data.userId,
                type: data.type,
                error: err?.message || String(err),
            });
            return null;
        }
    }
    /**
     * Helper to dispatch notification to all Super Admin users.
     */
    async notifyAdmins(data) {
        try {
            const userRepo = database_source_1.AppDataSource.getRepository(user_entity_1.User);
            const admins = await userRepo.find({
                where: [
                    { role: enum_constant_1.IROLES.ADMIN },
                    { role: 'SUPER_ADMIN' },
                ],
                select: ['id', 'email'],
            });
            for (const admin of admins) {
                await this.createNotification({
                    ...data,
                    userId: admin.id,
                });
            }
        }
        catch (err) {
            logger_1.logger.error('Failed to notify admins', {
                type: data.type,
                error: err?.message || String(err),
            });
        }
    }
    /**
     * Helper to dispatch notification to the owner of a given hostel.
     */
    async notifyHostelOwner(hostelId, data) {
        try {
            const hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
            const hostel = await hostelRepo.findOne({
                where: { id: hostelId },
                select: ['id', 'ownerId', 'name'],
            });
            if (hostel && hostel.ownerId) {
                return await this.createNotification({
                    ...data,
                    userId: hostel.ownerId,
                    hostelId: hostel.id,
                });
            }
            return null;
        }
        catch (err) {
            logger_1.logger.error('Failed to notify hostel owner', {
                hostelId,
                type: data.type,
                error: err?.message || String(err),
            });
            return null;
        }
    }
}
exports.NotificationService = NotificationService;
exports.notificationRepository = new notification_repository_1.NotificationRepository();
exports.notificationService = new NotificationService(exports.notificationRepository);
