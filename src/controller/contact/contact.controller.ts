import { Request, Response, NextFunction } from 'express';
import { ContactService } from '../../services/contact/contact.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { socketServer } from '../../socket/socket.server';
import { SocketEvent } from '../../constant/queue.constants';

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

      try {
        socketServer.toRole('ADMIN', SocketEvent.CONTACT_SUBMITTED, submission);
        socketServer.toRole('SUPER_ADMIN', SocketEvent.CONTACT_SUBMITTED, submission);
      } catch {
        // non-blocking
      }

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

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) {
        res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: 'ID is required.' });
        return;
      }
      const { status } = req.body;
      const updated = await this.contactService.updateStatus(id, status);
      if (!updated) {
        res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: 'Message not found.' });
        return;
      }
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, data: updated, message: 'Status updated successfully.' });
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
      const deleted = await this.contactService.deleteMessage(id);
      if (!deleted) {
        res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: 'Message not found.' });
        return;
      }
      res.status(STATUS_CODE.OK).json({ success: true, message: 'Message deleted successfully.' });
    } catch (error) {
      next(error);
    }
  };
}
