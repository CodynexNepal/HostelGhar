import { Router } from 'express';
import { NewsletterController } from '../../controller/newsletter/newsletter.controller';
import { NewsletterService } from '../../services/newsletter/newsletter.service';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';

export const newsletterRouter = Router();
const newsletterService = new NewsletterService();
const newsletterController = new NewsletterController(newsletterService);

// Public route to subscribe
newsletterRouter.post('/subscribe', newsletterController.subscribe);

// Public route to unsubscribe
newsletterRouter.post('/unsubscribe', newsletterController.unsubscribe);

// Admin-only route to list subscribers
newsletterRouter.get(
  '/',
  authenticate,
  requireRoles(IROLES.ADMIN),
  apiReadLimiter,
  newsletterController.list,
);

// Admin-only route to update subscriber status
newsletterRouter.patch(
  '/:id/status',
  authenticate,
  requireRoles(IROLES.ADMIN),
  newsletterController.updateStatus,
);

// Admin-only route to delete a subscriber
newsletterRouter.delete(
  '/:id',
  authenticate,
  requireRoles(IROLES.ADMIN),
  newsletterController.delete,
);
