import { Router } from 'express';
import { ContactController } from '../../controller/contact/contact.controller';
import { ContactService } from '../../services/contact/contact.service';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';

export const contactRouter = Router();
const contactService = new ContactService();
const contactController = new ContactController(contactService);

// Public route to submit a contact inquiry
contactRouter.post('/', contactController.submit);

// Admin-only route to list messages
contactRouter.get(
  '/',
  authenticate,
  requireRoles(IROLES.ADMIN),
  apiReadLimiter,
  contactController.list,
);

// Admin-only route to update message status
contactRouter.patch(
  '/:id/status',
  authenticate,
  requireRoles(IROLES.ADMIN),
  contactController.updateStatus,
);

// Admin-only route to delete message
contactRouter.delete('/:id', authenticate, requireRoles(IROLES.ADMIN), contactController.delete);
