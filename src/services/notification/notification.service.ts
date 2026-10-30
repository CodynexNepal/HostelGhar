// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.service.ts
// PURPOSE: Business logic for notifications, unread tracking, and real-time Socket.io delivery.
// ──────────────────────────────────────────────────────────────────────────────

import {
  NotificationRepository,
  CreateNotificationDto,
} from '../../repository/notification/notification.repository';
import { socketServer } from '../../socket/socket.server';
import { SocketEvent } from '../../constant/queue.constants';
import { AppDataSource } from '../../database/database-source';
import { User } from '../../entities/user.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { IROLES } from '../../constant/enum.constant';
import { logger } from '../../observability/logger';

export class NotificationService {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  public async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    isRead?: boolean,
    entityType?: string,
    hostelId?: string,
  ) {
    const [items, total] = await this.notificationRepo.findByUser(
      userId,
      page,
      limit,
      isRead,
      entityType,
      hostelId,
    );

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

  public async getUnreadCount(userId: string, hostelId?: string): Promise<{ count: number }> {
    const count = await this.notificationRepo.countUnreadByUser(userId, hostelId);
    return { count };
  }

  public async getUnreadCounts(
    userId: string,
    hostelId?: string,
  ): Promise<{ total: number; byCategory: Record<string, number> }> {
    return await this.notificationRepo.countUnreadByCategory(userId, hostelId);
  }

  public async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepo.markAsRead(notificationId, userId);
    if (notification) {
      // Broadcast updated counts to user
      const counts = await this.notificationRepo.countUnreadByCategory(
        userId,
        notification.hostelId || undefined,
      );
      socketServer.toUser(userId, 'notification:counts', counts);
    }
    return notification;
  }

  public async markAllAsRead(userId: string, entityType?: string, hostelId?: string) {
    const updatedCount = await this.notificationRepo.markAllAsRead(userId, entityType, hostelId);
    // Broadcast updated counts to user
    const counts = await this.notificationRepo.countUnreadByCategory(userId, hostelId);
    socketServer.toUser(userId, 'notification:counts', counts);
    return { updatedCount, counts };
  }

  public async deleteNotification(notificationId: string, userId: string) {
    const deleted = await this.notificationRepo.deleteNotification(notificationId, userId);
    if (deleted) {
      const counts = await this.notificationRepo.countUnreadByCategory(userId);
      socketServer.toUser(userId, 'notification:counts', counts);
    }
    return deleted;
  }

  /**
   * Primary entry point for creating notifications across the system.
   * Persists to PostgreSQL first, then broadcasts via Socket.io.
   */
  public async createNotification(data: CreateNotificationDto) {
    try {
      const notification = await this.notificationRepo.createNotification(data);

      // Fetch fresh category unread counts for recipient
      const counts = await this.notificationRepo.countUnreadByCategory(
        data.userId,
        data.hostelId || undefined,
      );

      // Realtime broadcast to specific user room: 'user:<userId>'
      socketServer.toUser(data.userId, SocketEvent.NOTIFICATION_RECEIVED, notification);
      socketServer.toUser(data.userId, 'notification:new', notification);
      socketServer.toUser(data.userId, 'notification:counts', counts);

      return notification;
    } catch (err: any) {
      logger.error('Failed to create and dispatch notification', {
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
  public async notifyAdmins(data: Omit<CreateNotificationDto, 'userId'>) {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const admins = await userRepo.find({
        where: [{ role: IROLES.ADMIN }, { role: 'SUPER_ADMIN' as any }],
        select: ['id', 'email'],
      });

      for (const admin of admins) {
        await this.createNotification({
          ...data,
          userId: admin.id,
        });
      }
    } catch (err: any) {
      logger.error('Failed to notify admins', {
        type: data.type,
        error: err?.message || String(err),
      });
    }
  }

  /**
   * Helper to dispatch notification to the owner of a given hostel.
   */
  public async notifyHostelOwner(
    hostelId: string,
    data: Omit<CreateNotificationDto, 'userId' | 'hostelId'>,
  ) {
    try {
      const hostelRepo = AppDataSource.getRepository(Hostel);
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
    } catch (err: any) {
      logger.error('Failed to notify hostel owner', {
        hostelId,
        type: data.type,
        error: err?.message || String(err),
      });
      return null;
    }
  }
}

export const notificationRepository = new NotificationRepository();
export const notificationService = new NotificationService(notificationRepository);
