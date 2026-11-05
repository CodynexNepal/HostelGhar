// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.controller.ts
// PURPOSE: Controller allowing users to book accommodations with pagination & 3-tier caching.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { CreateBookingDto } from '../../dto/booking/create-booking.dto';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { BookingService } from '../../services/booking/booking.service';
import { getRequiredParam } from '../../decorators/http.decorator';
import { normalizePagination } from '../../utils/pagination.util';
import { socketServer } from '../../socket/socket.server';
import { SocketEvent } from '../../constant/queue.constants';

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
        dto.studentName,
        dto.phone,
        dto.email,
      );
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      // Live broadcast to owner, admin, and resident
      try {
        socketServer.toHostel(dto.hostelId, SocketEvent.BOOKING_CONFIRMED, result.data);
        socketServer.toRole('ADMIN', SocketEvent.BOOKING_CONFIRMED, result.data);
        socketServer.toRole('SUPER_ADMIN', SocketEvent.BOOKING_CONFIRMED, result.data);
        socketServer.toRole('OWNER', SocketEvent.BOOKING_CONFIRMED, result.data);
        socketServer.toUser(userId, SocketEvent.BOOKING_CONFIRMED, result.data);
      } catch {
        // non-blocking socket emit
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
   * Get user's bookings with 3-tier caching and pagination
   */
  public getMyBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });

      const result = await this.bookingService.getUserBookings(userId, page, limit);

      res.status(STATUS_CODE.OK).json({
        success: true,
        ...result,
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
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });

      const result = await this.bookingService.getHostelBookings(hostelId, page, limit);

      res.status(STATUS_CODE.OK).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bookingId = getRequiredParam(req, 'id');
      const status = req.body.status ?? req.body.bookingStatus;
      const result = await this.bookingService.updateBookingStatus(
        bookingId,
        status,
        req.user!.userId,
        req.user!.role,
      );
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }
      try {
        socketServer.broadcast(SocketEvent.BOOKING_CONFIRMED, result.data);
      } catch {
        // non-blocking
      }
      res.status(STATUS_CODE.OK).json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  };

  public cancelBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bookingId = getRequiredParam(req, 'id');
      const result = await this.bookingService.cancelBooking(
        bookingId,
        req.user!.userId,
        req.user!.role,
      );
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
