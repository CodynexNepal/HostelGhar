import { Router } from 'express';
import { NewsletterController } from '../../controller/newsletter/newsletter.controller';
import { NewsletterService } from '../../services/newsletter/newsletter.service';

export const newsletterRouter = Router();
const newsletterService = new NewsletterService();
const newsletterController = new NewsletterController(newsletterService);

// Public route to subscribe
newsletterRouter.post('/subscribe', newsletterController.subscribe);

// Public route to unsubscribe
newsletterRouter.post('/unsubscribe', newsletterController.unsubscribe);
