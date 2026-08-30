// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.controller.ts
// PURPOSE: Controller allowing users with role 'USER' to book hostel accommodations.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { CreateBookingDto } from '../../dto/booking/create-booking.dto';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { BookingService } from '../../services/booking/booking.service';
import { getRequiredParam } from '../../decorators/http.decorator';

export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * Book a hostel room (Restricted to role: 'USER' only)
   */
  public bookHostel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const dto = req.body as CreateBookingDto;

      const result = await this.bookingService.createBooking(
        userId,
        dto.hostelId,
        dto.checkInDate,
        dto.remarks,
      );
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Hostel booking request submitted successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user's bookings with caching
   */
  public getMyBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { data, isCached } = await this.bookingService.getUserBookings(userId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        isCached,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  public getHostelBookings = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, ...(await this.bookingService.getHostelBookings(hostelId)) });
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bookingId = getRequiredParam(req, 'id');
      const result = await this.bookingService.updateBookingStatus(
        bookingId,
        req.body.status,
        req.user!.userId,
      );
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }
      res.status(STATUS_CODE.OK).json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  };

  public cancelBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bookingId = getRequiredParam(req, 'id');
      const result = await this.bookingService.cancelBooking(bookingId, req.user!.userId);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }
      res.status(STATUS_CODE.DELETED).json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  };
}
