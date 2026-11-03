import { Request, Response, NextFunction } from 'express';
import { ContactService } from '../../services/contact/contact.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';

export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  public submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, phone, subject, message } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'Full name is required.',
        });
        return;
      }

      if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'A valid email address is required.',
        });
        return;
      }

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'Message content is required.',
        });
        return;
      }

      const ipAddress = req.ip || req.socket.remoteAddress || null;

      const submission = await this.contactService.submitMessage({
        name,
        email,
        phone,
        subject,
        message,
        ipAddress,
      });

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message:
          "Thank you for reaching out! We've received your message and will reply within 24 hours.",
        data: {
          id: submission.id,
          createdAt: submission.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const result = await this.contactService.listMessages(page, limit);
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
