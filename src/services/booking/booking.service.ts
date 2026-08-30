import { BookingRepository } from '../../repository/booking/booking.repository';
import { BookingStatus } from '../../enum/booking.enum';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { SocketEvent } from '../../constant/queue.constants';

export class BookingService {
  constructor(private readonly bookingRepository: BookingRepository) {}

  public async createBooking(
    userId: string,
    hostelId: string,
    checkInDate: string,
    remarks?: string,
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
      status: BookingStatus.PENDING,
    });

    await cacheService.invalidatePattern(`user:bookings:${userId}`);
    if (hostel.ownerId) {
      await eventDispatcher.dispatch({
        type: SocketEvent.BOOKING_CONFIRMED,
        payload: booking,
        userId: hostel.ownerId,
        hostelId,
      });
    }

    return { data: booking };
  }

  public async getUserBookings(userId: string) {
    const cacheKey = cacheService.generateKey('user:bookings', userId);
    const { data, isCached } = await cacheService.wrap(
      cacheKey,
      async () => this.bookingRepository.findBookingsByUser(userId),
      60,
    );
    return { data, isCached };
  }

  public async getHostelBookings(hostelId: string) {
    return { data: await this.bookingRepository.findBookingsByHostel(hostelId) };
  }

  public async updateBookingStatus(bookingId: string, status: string, actorId: string) {
    if (!Object.values(BookingStatus).includes(status as BookingStatus)) {
      return { error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid booking status' } };
    }

    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Booking not found' } };
    }

    booking.status = status as BookingStatus;
    const savedBooking = await this.bookingRepository.save(booking);
    await cacheService.invalidatePattern(`user:bookings:${booking.userId}`);

    await eventDispatcher.dispatch({
      type: SocketEvent.BOOKING_CONFIRMED,
      payload: savedBooking,
      userId: booking.userId,
      hostelId: booking.hostelId,
      metadata: { actorId, bookingId },
    });

    return { data: savedBooking };
  }

  public async cancelBooking(bookingId: string, userId: string) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking || booking.userId !== userId) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Booking not found' } };
    }

    booking.status = BookingStatus.CANCELLED;
    const savedBooking = await this.bookingRepository.save(booking);
    await cacheService.invalidatePattern(`user:bookings:${userId}`);

    await eventDispatcher.dispatch({
      type: SocketEvent.BOOKING_CONFIRMED,
      payload: savedBooking,
      userId,
      hostelId: booking.hostelId,
      metadata: { bookingId, cancelled: true },
    });

    return { data: savedBooking };
  }
}
