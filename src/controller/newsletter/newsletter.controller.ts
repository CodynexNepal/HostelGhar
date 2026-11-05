import { Request, Response, NextFunction } from 'express';
import { NewsletterService } from '../../services/newsletter/newsletter.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { socketServer } from '../../socket/socket.server';
import { SocketEvent } from '../../constant/queue.constants';

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

      try {
        socketServer.toRole('ADMIN', SocketEvent.NEWSLETTER_SUBSCRIBED, subscription);
        socketServer.toRole('SUPER_ADMIN', SocketEvent.NEWSLETTER_SUBSCRIBED, subscription);
      } catch {
        // non-blocking
      }

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
      try {
        socketServer.toRole('ADMIN', SocketEvent.NEWSLETTER_SUBSCRIBED, {
          email,
          status: 'UNSUBSCRIBED',
        });
        socketServer.toRole('SUPER_ADMIN', SocketEvent.NEWSLETTER_SUBSCRIBED, {
          email,
          status: 'UNSUBSCRIBED',
        });
      } catch {
        // non-blocking
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'You have been unsubscribed from newsletter updates.',
      });
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const result = await this.newsletterService.listSubscriptions(page, limit);
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) {
        res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: 'ID is required.' });
        return;
      }
      const deleted = await this.newsletterService.deleteSubscription(id);
      if (!deleted) {
        res
          .status(STATUS_CODE.NOT_FOUND)
          .json({ success: false, message: 'Subscriber not found.' });
        return;
      }
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, message: 'Subscriber removed successfully.' });
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) {
        res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: 'ID is required.' });
        return;
      }
      const { status } = req.body;
      const updated = await this.newsletterService.updateStatus(id, status);
      if (!updated) {
        res
          .status(STATUS_CODE.NOT_FOUND)
          .json({ success: false, message: 'Subscriber not found.' });
        return;
      }
      try {
        socketServer.toRole('ADMIN', SocketEvent.NEWSLETTER_SUBSCRIBED, updated);
        socketServer.toRole('SUPER_ADMIN', SocketEvent.NEWSLETTER_SUBSCRIBED, updated);
      } catch {
        // non-blocking
      }
      res.status(STATUS_CODE.OK).json({ success: true, data: updated, message: 'Status updated.' });
    } catch (error) {
      next(error);
    }
  };
}
