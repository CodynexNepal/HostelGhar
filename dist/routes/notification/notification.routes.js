"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.routes.ts
// PURPOSE: Route definitions for user notifications and unread badges.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const express_1 = require("express");
const notification_controller_1 = require("../../controller/notification/notification.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All notification routes require authentication
router.use(auth_middleware_1.authenticate);
router.get('/unread-count', notification_controller_1.notificationController.getUnreadCount);
router.get('/unread-counts', notification_controller_1.notificationController.getUnreadCounts);
router.patch('/read-all', notification_controller_1.notificationController.markAllAsRead);
router.patch('/:id/read', notification_controller_1.notificationController.markAsRead);
router.delete('/:id', notification_controller_1.notificationController.deleteNotification);
router.get('/', notification_controller_1.notificationController.getNotifications);
exports.notificationRouter = router;
