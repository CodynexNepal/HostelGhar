"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingService = void 0;
const booking_enum_1 = require("../../enum/booking.enum");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const cache_util_1 = require("../../utils/cache.util");
const event_dispatcher_util_1 = require("../../utils/event-dispatcher.util");
const queue_constants_1 = require("../../constant/queue.constants");
const pagination_util_1 = require("../../utils/pagination.util");
const notification_service_1 = require("../notification/notification.service");
class BookingService {
    constructor(bookingRepository) {
        this.bookingRepository = bookingRepository;
    }
    async createBooking(userId, hostelId, checkInDate, remarks, studentName, phone, email) {
        const hostel = await this.bookingRepository.findHostelById(hostelId);
        if (!hostel) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
        }
        const existingBooking = await this.bookingRepository.findExistingPendingBooking(userId, hostelId);
        if (existingBooking) {
            return {
                error: {
                    status: statusCode_interface_1.STATUS_CODE.CONFLICT,
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
            status: booking_enum_1.BookingStatus.PENDING,
        });
        // Invalidate caches across all tiers
        await cache_util_1.cacheService.invalidatePattern(`user:bookings:${userId}`);
        await cache_util_1.cacheService.invalidatePattern(`hostel:bookings:${hostelId}`);
        if (hostel.ownerId) {
            await event_dispatcher_util_1.eventDispatcher.dispatch({
                type: queue_constants_1.SocketEvent.BOOKING_CONFIRMED,
                payload: booking,
                userId: hostel.ownerId,
                hostelId,
            });
            // Dispatch persistent notification with unread count updates
            await notification_service_1.notificationService.createNotification({
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
    async getUserBookings(userId, page = 1, limit = 20) {
        const cacheKey = cache_util_1.cacheService.generateKey('user:bookings', { userId, page, limit });
        // 3-Level Cache: L1 (LRU RAM) -> L2 (Redis) -> L3 (DB)
        const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const [bookings, total] = await this.bookingRepository.findBookingsByUser(userId, page, limit);
            return { bookings, total };
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return (0, pagination_util_1.createPaginatedResponse)(data.bookings, data.total, { page, limit }, { isCached, cacheLevel });
    }
    async getHostelBookings(hostelId, page = 1, limit = 20) {
        const cacheKey = cache_util_1.cacheService.generateKey('hostel:bookings', { hostelId, page, limit });
        const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const [bookings, total] = await this.bookingRepository.findBookingsByHostel(hostelId, page, limit);
            return { bookings, total };
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return (0, pagination_util_1.createPaginatedResponse)(data.bookings, data.total, { page, limit }, { isCached, cacheLevel });
    }
    async updateBookingStatus(bookingId, status, actorId) {
        if (!Object.values(booking_enum_1.BookingStatus).includes(status)) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'Invalid booking status' } };
        }
        const booking = await this.bookingRepository.findById(bookingId);
        if (!booking) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Booking not found' } };
        }
        booking.status = status;
        const savedBooking = await this.bookingRepository.save(booking);
        // Invalidate caches
        await cache_util_1.cacheService.invalidatePattern(`user:bookings:${booking.userId}`);
        await cache_util_1.cacheService.invalidatePattern(`hostel:bookings:${booking.hostelId}`);
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.BOOKING_CONFIRMED,
            payload: savedBooking,
            userId: booking.userId,
            hostelId: booking.hostelId,
            metadata: { actorId, bookingId },
        });
        // Notify resident of booking status change
        await notification_service_1.notificationService.createNotification({
            userId: booking.userId,
            hostelId: booking.hostelId,
            type: 'BOOKING_STATUS',
            entityType: 'booking',
            entityId: booking.id,
            title: `Booking ${status}`,
            message: `Your hostel booking status has been updated to ${status}.`,
            targetUrl: '/resident/bookings',
            metadata: { bookingId: booking.id, status },
        });
        return { data: savedBooking };
    }
    async cancelBooking(bookingId, userId) {
        const booking = await this.bookingRepository.findById(bookingId);
        if (!booking || booking.userId !== userId) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Booking not found' } };
        }
        booking.status = booking_enum_1.BookingStatus.CANCELLED;
        const savedBooking = await this.bookingRepository.save(booking);
        // Invalidate caches
        await cache_util_1.cacheService.invalidatePattern(`user:bookings:${userId}`);
        await cache_util_1.cacheService.invalidatePattern(`hostel:bookings:${booking.hostelId}`);
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.BOOKING_CONFIRMED,
            payload: savedBooking,
            userId,
            hostelId: booking.hostelId,
            metadata: { bookingId, cancelled: true },
        });
        return { data: savedBooking };
    }
}
exports.BookingService = BookingService;
