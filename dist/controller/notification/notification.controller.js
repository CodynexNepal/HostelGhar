"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.controller.ts
// PURPOSE: HTTP endpoints for notifications, unread counts, and read status updates.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = exports.NotificationController = void 0;
const notification_service_1 = require("../../services/notification/notification.service");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const pagination_util_1 = require("../../utils/pagination.util");
class NotificationController {
    constructor(service = notification_service_1.notificationService) {
        this.service = service;
        this.getNotifications = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;
                const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
                const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
                const result = await this.service.getNotifications(userId, page, limit, isRead, entityType, hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
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
            }
            catch (error) {
                next(error);
            }
        };
        this.getUnreadCount = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
                const { count } = await this.service.getUnreadCount(userId, hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: { count },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getUnreadCounts = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
                const counts = await this.service.getUnreadCounts(userId, hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: counts,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.markAsRead = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const rawId = req.params.id;
                const id = Array.isArray(rawId) ? rawId[0] : rawId;
                if (!id) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'Notification ID is required',
                    });
                    return;
                }
                const notification = await this.service.markAsRead(id, userId);
                if (!notification) {
                    res.status(statusCode_interface_1.STATUS_CODE.NOT_FOUND).json({
                        success: false,
                        message: 'Notification not found or access denied',
                    });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: notification,
                    message: 'Notification marked as read',
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.markAllAsRead = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const entityType = typeof req.body?.entityType === 'string'
                    ? req.body.entityType
                    : typeof req.query.entityType === 'string'
                        ? req.query.entityType
                        : undefined;
                const hostelId = typeof req.body?.hostelId === 'string'
                    ? req.body.hostelId
                    : typeof req.query.hostelId === 'string'
                        ? req.query.hostelId
                        : undefined;
                const result = await this.service.markAllAsRead(userId, entityType, hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result,
                    message: 'All relevant notifications marked as read',
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.deleteNotification = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const rawId = req.params.id;
                const id = Array.isArray(rawId) ? rawId[0] : rawId;
                if (!id) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'Notification ID is required',
                    });
                    return;
                }
                const deleted = await this.service.deleteNotification(id, userId);
                if (!deleted) {
                    res.status(statusCode_interface_1.STATUS_CODE.NOT_FOUND).json({
                        success: false,
                        message: 'Notification not found or access denied',
                    });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Notification deleted successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.NotificationController = NotificationController;
exports.notificationController = new NotificationController();
