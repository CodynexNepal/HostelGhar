// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.routes.ts
// PURPOSE: Route definitions for user notifications and unread badges.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { notificationController } from '../../controller/notification/notification.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

router.get('/unread-count', notificationController.getUnreadCount);
router.get('/unread-counts', notificationController.getUnreadCounts);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.get('/', notificationController.getNotifications);

export const notificationRouter = router;
