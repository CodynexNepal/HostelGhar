import { BookingRepository } from '../../repository/booking/booking.repository';
import { BookingStatus } from '../../enum/booking.enum';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { IROLES } from '../../enum/roles.enum';
import { cacheService } from '../../utils/cache.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { SocketEvent } from '../../constant/queue.constants';
import { createPaginatedResponse } from '../../utils/pagination.util';
import { notificationService } from '../notification/notification.service';

export class BookingService {
  constructor(private readonly bookingRepository: BookingRepository) {}

  public async createBooking(
    userId: string,
    hostelId: string,
    checkInDate: string,
    remarks?: string,
    studentName?: string,
    phone?: string,
    email?: string,
  ) {
    const hostel = await this.bookingRepository.findHostelById(hostelId);
    if (!hostel) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
    }

    const existingBooking = await this.bookingRepository.findExistingPendingBooking(
      userId,
      hostelId,
    );
    if (existingBooking) {
      return {
        error: {
          status: STATUS_CODE.CONFLICT,
          message: 'You already have a pending booking application for this hostel',
        },
      };
    }

    const booking = await this.bookingRepository.createBooking({
      userId,
      hostelId,
      checkInDate,
      remarks: remarks || null,
      studentName: studentName || null,
      phone: phone || null,
      email: email || null,
      status: BookingStatus.PENDING,
    });

    // Invalidate caches across all tiers
    await cacheService.invalidatePattern(`user:bookings:${userId}`);
    await cacheService.invalidatePattern(`hostel:bookings:${hostelId}`);

    if (hostel.ownerId) {
      await eventDispatcher.dispatch({
        type: SocketEvent.BOOKING_CONFIRMED,
        payload: booking,
        userId: hostel.ownerId,
        hostelId,
      });

      // Dispatch persistent notification with unread count updates
      await notificationService.createNotification({
        userId: hostel.ownerId,
        hostelId,
        type: 'BOOKING_NEW',
        entityType: 'booking',
        entityId: booking.id,
        title: 'New Booking Request',
        message: `New booking request from ${studentName || email || 'a resident'} for check-in on ${checkInDate}.`,
        targetUrl: '/hostel/bookings',
        metadata: { bookingId: booking.id, studentName, checkInDate },
      });
    }

    return { data: booking };
  }

  public async getUserBookings(userId: string, page: number = 1, limit: number = 20) {
    const cacheKey = cacheService.generateKey('user:bookings', { userId, page, limit });

    // 3-Level Cache: L1 (LRU RAM) -> L2 (Redis) -> L3 (DB)
    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        const [bookings, total] = await this.bookingRepository.findBookingsByUser(
          userId,
          page,
          limit,
        );
        return { bookings, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    return createPaginatedResponse(
      data.bookings,
      data.total,
      { page, limit },
      { isCached, cacheLevel },
    );
  }

  public async getHostelBookings(hostelId: string, page: number = 1, limit: number = 20) {
    const cacheKey = cacheService.generateKey('hostel:bookings', { hostelId, page, limit });

    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        const [bookings, total] = await this.bookingRepository.findBookingsByHostel(
          hostelId,
          page,
          limit,
        );
        return { bookings, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    return createPaginatedResponse(
      data.bookings,
      data.total,
      { page, limit },
      { isCached, cacheLevel },
    );
  }

  public async updateBookingStatus(
    bookingId: string,
    status: string,
    actorId: string,
    actorRole?: string,
  ) {
    const rawStatus = (status || '').toString().trim().toUpperCase();
    let targetStatus: BookingStatus;

    if (rawStatus === 'APPROVED' || rawStatus === 'CONFIRMED') {
      targetStatus = BookingStatus.APPROVED;
    } else if (rawStatus === 'CANCELLED' || rawStatus === 'CANCELED') {
      targetStatus = BookingStatus.CANCELLED;
    } else if (rawStatus === 'REJECTED') {
      targetStatus = BookingStatus.REJECTED;
    } else if (rawStatus === 'PENDING') {
      targetStatus = BookingStatus.PENDING;
    } else {
      return {
        error: {
          status: STATUS_CODE.BAD_REQUEST,
          message: `Invalid booking status: ${status}. Must be one of APPROVED, REJECTED, CANCELLED, PENDING`,
        },
      };
    }

    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Booking not found' } };
    }

    if (actorRole) {
      const role = actorRole.toLowerCase();
      const isAdmin = role === IROLES.ADMIN || role === 'admin';
      const isOwnerOfHostel = booking.hostel?.ownerId === actorId;
      if (!isAdmin && !isOwnerOfHostel) {
        return {
          error: {
            status: STATUS_CODE.FORBIDDEN,
            message: 'You do not have permission to update bookings for this hostel',
          },
        };
      }
    }

    booking.status = targetStatus;
    let savedBooking: any;
    try {
      savedBooking = await this.bookingRepository.save(booking);
    } catch (dbErr: any) {
      // Self-healing fallback: If PostgreSQL enum type doesn't have 'APPROVED' yet,
      // fallback to 'CONFIRMED' so the operation succeeds without 500 crash.
      if (
        targetStatus === BookingStatus.APPROVED &&
        (dbErr?.message?.includes('bookings_status_enum') ||
          dbErr?.message?.includes('invalid input value for enum'))
      ) {
        booking.status = BookingStatus.CONFIRMED;
        savedBooking = await this.bookingRepository.save(booking);
      } else {
        throw dbErr;
      }
    }

    // Invalidate caches across all tiers
    await cacheService.invalidatePattern(`user:bookings:${booking.userId}`);
    await cacheService.invalidatePattern(`hostel:bookings:${booking.hostelId}`);

    await eventDispatcher.dispatch({
      type: SocketEvent.BOOKING_CONFIRMED,
      payload: savedBooking,
      userId: booking.userId,
      hostelId: booking.hostelId,
      metadata: { actorId, bookingId },
    });

    // Notify resident of booking status change
    await notificationService.createNotification({
      userId: booking.userId,
      hostelId: booking.hostelId,
      type: 'BOOKING_STATUS',
      entityType: 'booking',
      entityId: booking.id,
      title: `Booking ${targetStatus}`,
      message: `Your hostel booking status has been updated to ${targetStatus}.`,
      targetUrl: '/resident/bookings',
      metadata: { bookingId: booking.id, status: targetStatus },
    });

    return { data: savedBooking };
  }

  public async cancelBooking(bookingId: string, actorId: string, actorRole?: string) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Booking not found' } };
    }

    const role = (actorRole || '').toLowerCase();
    const isAdmin = role === IROLES.ADMIN || role === 'admin';
    const isOwner = role === IROLES.OWNER || role === 'owner';
    const isOwnerOfHostel = isOwner && booking.hostel?.ownerId === actorId;
    const isBookingUser = booking.userId === actorId;

    if (!isAdmin && !isOwnerOfHostel && !isBookingUser) {
      return {
        error: {
          status: STATUS_CODE.FORBIDDEN,
          message: 'You do not have permission to delete or cancel this booking',
        },
      };
    }

    // If owner or admin deletes it, delete the record completely from database
    if (isAdmin || isOwnerOfHostel) {
      await this.bookingRepository.delete(bookingId);
    } else {
      // User cancelling their own booking
      booking.status = BookingStatus.CANCELLED;
      await this.bookingRepository.save(booking);
    }

    // Invalidate caches
    await cacheService.invalidatePattern(`user:bookings:${booking.userId}`);
    await cacheService.invalidatePattern(`hostel:bookings:${booking.hostelId}`);

    await eventDispatcher.dispatch({
      type: SocketEvent.BOOKING_CONFIRMED,
      payload: { id: bookingId, status: BookingStatus.CANCELLED },
      userId: booking.userId,
      hostelId: booking.hostelId,
      metadata: { bookingId, cancelled: true, deletedBy: actorId },
    });

    return { data: { id: bookingId, success: true, message: 'Booking deleted successfully' } };
  }
}
