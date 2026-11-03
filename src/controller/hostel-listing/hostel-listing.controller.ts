import { Request, Response, NextFunction } from 'express';
import { HostelListingService } from '../../services/hostel-listing/hostel-listing.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';

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
}
