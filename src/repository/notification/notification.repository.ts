// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.repository.ts
// PURPOSE: Data access layer for notifications and unread counter aggregations.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Notification } from '../../entities/notification/notification.entity';

export interface CreateNotificationDto {
  userId: string;
  hostelId?: string | null;
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId?: string | null;
  targetUrl?: string | null;
  metadata?: Record<string, any> | null;
}

export class NotificationRepository {
  private readonly repo: Repository<Notification>;

  constructor() {
    this.repo = AppDataSource.getRepository(Notification);
  }

  public async createNotification(data: CreateNotificationDto): Promise<Notification> {
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

  public async findById(id: string): Promise<Notification | null> {
    return await this.repo.findOne({ where: { id } });
  }

  public async findByUser(
    userId: string,
    page: number = 1,
    limit: number = 20,
    isRead?: boolean,
    entityType?: string,
    hostelId?: string,
  ): Promise<[Notification[], number]> {
    const query = this.repo.createQueryBuilder('n').where('n.userId = :userId', { userId });

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

  public async countUnreadByUser(userId: string, hostelId?: string): Promise<number> {
    const query = this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.isRead = :isRead', { isRead: false });

    if (hostelId) {
      query.andWhere('(n.hostelId = :hostelId OR n.hostelId IS NULL)', { hostelId });
    }

    return await query.getCount();
  }

  public async countUnreadByCategory(
    userId: string,
    hostelId?: string,
  ): Promise<{ total: number; byCategory: Record<string, number> }> {
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

    const byCategory: Record<string, number> = {
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
      } else {
        byCategory[cat.slice(0, -1)] = count;
      }
    }

    return { total, byCategory };
  }

  public async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    const notification = await this.repo.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) return null;

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      return await this.repo.save(notification);
    }

    return notification;
  }

  public async markAllAsRead(
    userId: string,
    entityType?: string,
    hostelId?: string,
  ): Promise<number> {
    const query = this.repo
      .createQueryBuilder()
      .update(Notification)
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

  public async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.repo.delete({ id: notificationId, userId });
    return (result.affected ?? 0) > 0;
  }
}
