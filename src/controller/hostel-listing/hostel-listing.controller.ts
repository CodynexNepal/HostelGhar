import { Request, Response, NextFunction } from 'express';
import { HostelListingService } from '../../services/hostel-listing/hostel-listing.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { socketServer } from '../../socket/socket.server';
import { SocketEvent } from '../../constant/queue.constants';

export class HostelListingController {
  constructor(private readonly listingService: HostelListingService) {}

  public submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        hostelName,
        type,
        totalBeds,
        phone,
        city,
        area,
        address,
        priceFrom,
        negotiable,
        amenities,
        description,
        rules,
        photos,
        ownerName,
        email,
      } = req.body;

      if (!hostelName || typeof hostelName !== 'string' || hostelName.trim().length === 0) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'Hostel name is required.',
        });
        return;
      }

      if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'Contact phone number is required.',
        });
        return;
      }

      if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'A valid owner email is required.',
        });
        return;
      }

      if (!ownerName || typeof ownerName !== 'string' || ownerName.trim().length === 0) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'Owner name is required.',
        });
        return;
      }

      const ipAddress = req.ip || req.socket.remoteAddress || null;

      const submission = await this.listingService.submitListingRequest({
        hostelName,
        type: type || 'coed',
        totalBeds: parseInt(totalBeds, 10) || 0,
        phone,
        city: city || 'Kathmandu',
        area,
        address: address || '',
        priceFrom: priceFrom ? parseFloat(priceFrom) : null,
        negotiable: Boolean(negotiable),
        amenities,
        description,
        rules,
        photos,
        ownerName,
        email,
        ipAddress,
      });

      try {
        socketServer.toRole('ADMIN', SocketEvent.LISTING_REQUEST_CREATED, submission);
        socketServer.toRole('SUPER_ADMIN', SocketEvent.LISTING_REQUEST_CREATED, submission);
      } catch {
        // non-blocking
      }

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message:
          'Your hostel listing request has been submitted successfully! Our team will review and contact you shortly.',
        data: {
          id: submission.id,
          hostelName: submission.hostelName,
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
      const result = await this.listingService.listRequests(page, limit);
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
      const { status, adminNotes } = req.body;
      const updated = await this.listingService.updateStatus(id, status, adminNotes);
      if (!updated) {
        res
          .status(STATUS_CODE.NOT_FOUND)
          .json({ success: false, message: 'Listing request not found.' });
        return;
      }
      try {
        socketServer.toRole('ADMIN', 'listing_request:updated', updated);
        socketServer.toRole('SUPER_ADMIN', 'listing_request:updated', updated);
      } catch {
        // non-blocking
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
      const deleted = await this.listingService.deleteRequest(id);
      if (!deleted) {
        res
          .status(STATUS_CODE.NOT_FOUND)
          .json({ success: false, message: 'Listing request not found.' });
        return;
      }
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, message: 'Listing request deleted successfully.' });
    } catch (error) {
      next(error);
    }
  };
}
