import { Request, Response, NextFunction } from 'express';
import { NewsletterService } from '../../services/newsletter/newsletter.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';

export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  public subscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, source } = req.body;

      if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'Please provide a valid email address.',
        });
        return;
      }

      const ipAddress = req.ip || req.socket.remoteAddress || null;
      const { subscription, isNew } = await this.newsletterService.subscribe(
        email,
        source || 'website-footer',
        ipAddress,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: isNew
          ? 'Welcome to the Hostel Ghar community! You are now subscribed.'
          : 'You are already on our priority newsletter list!',
        data: {
          email: subscription.email,
          createdAt: subscription.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public unsubscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'Email is required to unsubscribe.',
        });
        return;
      }
      await this.newsletterService.unsubscribe(email);
      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'You have been unsubscribed from newsletter updates.',
      });
    } catch (error) {
      next(error);
    }
  };
}
