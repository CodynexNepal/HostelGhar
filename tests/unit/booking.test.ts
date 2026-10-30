import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Booking } from '../../src/entities/booking/booking.entity';
import { CreateBookingDto } from '../../src/dto/booking/create-booking.dto';
import { BookingService } from '../../src/services/booking/booking.service';
import { BookingController } from '../../src/controller/booking/booking.controller';
import { BookingStatus } from '../../src/enum/booking.enum';
import { STATUS_CODE } from '../../src/constant/statusCode.interface';

vi.mock('../../src/utils/cache.util', () => ({
  cacheService: {
    invalidatePattern: vi.fn().mockResolvedValue(true),
    wrap: vi.fn(),
    generateKey: vi.fn(),
  },
}));

vi.mock('../../src/utils/event-dispatcher.util', () => ({
  eventDispatcher: {
    dispatch: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Booking Entity & DTO & Service with student contact fields', () => {
  describe('Booking Entity', () => {
    it('instantiates correctly with studentName, phone, and email', () => {
      const booking = new Booking();
      booking.id = '123e4567-e89b-12d3-a456-426614174000';
      booking.userId = '123e4567-e89b-12d3-a456-426614174001';
      booking.hostelId = '123e4567-e89b-12d3-a456-426614174002';
      booking.checkInDate = '2026-11-01';
      booking.remarks = 'Quiet room requested';
      booking.studentName = 'Aarav Sharma';
      booking.phone = '+977-9812345678';
      booking.email = 'aarav@example.com';
      booking.status = BookingStatus.PENDING;

      expect(booking.studentName).toBe('Aarav Sharma');
      expect(booking.phone).toBe('+977-9812345678');
      expect(booking.email).toBe('aarav@example.com');
      expect(booking.remarks).toBe('Quiet room requested');
      expect(booking.status).toBe(BookingStatus.PENDING);
    });
  });

  describe('CreateBookingDto Validation', () => {
    it('validates a complete valid payload with optional student contact fields', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        hostelId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        checkInDate: '2026-11-01',
        remarks: 'Near window',
        studentName: 'Aarav Sharma',
        phone: '9812345678',
        email: 'aarav@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('validates a payload when optional fields are omitted', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        hostelId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        checkInDate: '2026-11-01',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when email format is invalid', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        hostelId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        checkInDate: '2026-11-01',
        email: 'invalid-email-string',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
    });
  });

  describe('BookingService createBooking', () => {
    it('persists studentName, phone, and email into the repository', async () => {
      const mockHostel = { id: 'hostel-1', ownerId: 'owner-1' };
      const createdBooking = {
        id: 'booking-1',
        userId: 'user-1',
        hostelId: 'hostel-1',
        checkInDate: '2026-11-01',
        remarks: 'First floor please',
        studentName: 'Rohan Shrestha',
        phone: '9841000000',
        email: 'rohan@example.com',
        status: BookingStatus.PENDING,
      };

      const mockRepo = {
        findHostelById: vi.fn().mockResolvedValue(mockHostel),
        findExistingPendingBooking: vi.fn().mockResolvedValue(null),
        createBooking: vi.fn().mockResolvedValue(createdBooking),
      } as any;

      const service = new BookingService(mockRepo);
      const result = await service.createBooking(
        'user-1',
        'hostel-1',
        '2026-11-01',
        'First floor please',
        'Rohan Shrestha',
        '9841000000',
        'rohan@example.com',
      );

      expect(result.data).toBeDefined();
      expect(result.data?.studentName).toBe('Rohan Shrestha');
      expect(result.data?.phone).toBe('9841000000');
      expect(result.data?.email).toBe('rohan@example.com');
      expect(mockRepo.createBooking).toHaveBeenCalledWith({
        userId: 'user-1',
        hostelId: 'hostel-1',
        checkInDate: '2026-11-01',
        remarks: 'First floor please',
        studentName: 'Rohan Shrestha',
        phone: '9841000000',
        email: 'rohan@example.com',
        status: BookingStatus.PENDING,
      });
    });
  });

  describe('BookingController bookHostel', () => {
    it('calls bookingService.createBooking with dto fields including studentName, phone, and email', async () => {
      const mockBookingService = {
        createBooking: vi.fn().mockResolvedValue({
          data: {
            id: 'booking-1',
            studentName: 'Sita Sharma',
            phone: '9851000000',
            email: 'sita@example.com',
          },
        }),
      } as any;

      const controller = new BookingController(mockBookingService);

      const req: any = {
        user: { userId: 'user-123' },
        body: {
          hostelId: 'hostel-abc',
          checkInDate: '2026-12-01',
          remarks: 'Vegetarian meal preference',
          studentName: 'Sita Sharma',
          phone: '9851000000',
          email: 'sita@example.com',
        },
      };

      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res: any = { status: statusMock };
      const next = vi.fn();

      await controller.bookHostel(req, res, next);

      expect(mockBookingService.createBooking).toHaveBeenCalledWith(
        'user-123',
        'hostel-abc',
        '2026-12-01',
        'Vegetarian meal preference',
        'Sita Sharma',
        '9851000000',
        'sita@example.com',
      );
      expect(statusMock).toHaveBeenCalledWith(STATUS_CODE.CREATED);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Hostel booking request submitted successfully',
        data: expect.objectContaining({ studentName: 'Sita Sharma' }),
      });
    });
  });

  describe('BookingService updateBookingStatus & cancelBooking', () => {
    it('approves booking with case-insensitive status and CONFIRMED alias', async () => {
      const mockBooking = {
        id: 'booking-1',
        userId: 'user-1',
        hostelId: 'hostel-1',
        status: BookingStatus.PENDING,
        hostel: { ownerId: 'owner-1' },
      };

      const mockRepo = {
        findById: vi.fn().mockResolvedValue(mockBooking),
        save: vi.fn().mockImplementation((b) => Promise.resolve(b)),
      } as any;

      const service = new BookingService(mockRepo);

      // Testing lowercase 'approved'
      const res1 = await service.updateBookingStatus('booking-1', 'approved', 'owner-1', 'owner');
      expect(res1.data?.status).toBe(BookingStatus.APPROVED);

      // Testing uppercase 'APPROVED'
      const res2 = await service.updateBookingStatus('booking-1', 'APPROVED', 'owner-1', 'owner');
      expect(res2.data?.status).toBe(BookingStatus.APPROVED);

      // Testing legacy 'CONFIRMED'
      const res3 = await service.updateBookingStatus('booking-1', 'CONFIRMED', 'owner-1', 'owner');
      expect(res3.data?.status).toBe(BookingStatus.APPROVED);

      // Testing invalid status returns 400
      const res4 = await service.updateBookingStatus(
        'booking-1',
        'INVALID_STATUS',
        'owner-1',
        'owner',
      );
      expect(res4.error?.status).toBe(STATUS_CODE.BAD_REQUEST);
    });

    it('allows owner to delete booking from their hostel', async () => {
      const mockBooking = {
        id: 'booking-1',
        userId: 'user-1',
        hostelId: 'hostel-1',
        status: BookingStatus.PENDING,
        hostel: { ownerId: 'owner-1' },
      };

      const mockRepo = {
        findById: vi.fn().mockResolvedValue(mockBooking),
        delete: vi.fn().mockResolvedValue(undefined),
      } as any;

      const service = new BookingService(mockRepo);
      const result = await service.cancelBooking('booking-1', 'owner-1', 'owner');

      expect(result.data).toBeDefined();
      expect(result.data?.success).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith('booking-1');
    });
  });
});
