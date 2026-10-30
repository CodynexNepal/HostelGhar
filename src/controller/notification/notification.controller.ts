// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.controller.ts
// PURPOSE: HTTP endpoints for notifications, unread counts, and read status updates.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import {
  notificationService,
  NotificationService,
} from '../../services/notification/notification.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { normalizePagination } from '../../utils/pagination.util';

export class NotificationController {
  constructor(private readonly service: NotificationService = notificationService) {}

  public getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });

      const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;
      const entityType =
        typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
      const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;

      const result = await this.service.getNotifications(
        userId,
        page,
        limit,
        isRead,
        entityType,
        hostelId,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getUnreadCount = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
      const { count } = await this.service.getUnreadCount(userId, hostelId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  };

  public getUnreadCounts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
      const counts = await this.service.getUnreadCounts(userId, hostelId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: counts,
      });
    } catch (error) {
      next(error);
    }
  };

  public markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;

      if (!id) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'Notification ID is required',
        });
        return;
      }

      const notification = await this.service.markAsRead(id, userId);

      if (!notification) {
        res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: 'Notification not found or access denied',
        });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: notification,
        message: 'Notification marked as read',
      });
    } catch (error) {
      next(error);
    }
  };

  public markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const entityType =
        typeof req.body?.entityType === 'string'
          ? req.body.entityType
          : typeof req.query.entityType === 'string'
            ? req.query.entityType
            : undefined;
      const hostelId =
        typeof req.body?.hostelId === 'string'
          ? req.body.hostelId
          : typeof req.query.hostelId === 'string'
            ? req.query.hostelId
            : undefined;

      const result = await this.service.markAllAsRead(userId, entityType, hostelId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: result,
        message: 'All relevant notifications marked as read',
      });
    } catch (error) {
      next(error);
    }
  };

  public deleteNotification = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;

      if (!id) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'Notification ID is required',
        });
        return;
      }

      const deleted = await this.service.deleteNotification(id, userId);

      if (!deleted) {
        res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: 'Notification not found or access denied',
        });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const notificationController = new NotificationController();
