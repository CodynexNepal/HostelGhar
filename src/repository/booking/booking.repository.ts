// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.repository.ts
// PURPOSE: Data access layer for Hostel Bookings by users.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Booking } from '../../entities/booking/booking.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { BookingStatus } from '../../enum/booking.enum';

export class BookingRepository {
  private bookingRepo: Repository<Booking>;
  private hostelRepo: Repository<Hostel>;

  constructor() {
    this.bookingRepo = AppDataSource.getRepository(Booking);
    this.hostelRepo = AppDataSource.getRepository(Hostel);
  }

  public async findHostelById(id: string): Promise<Hostel | null> {
    return await this.hostelRepo.findOne({ where: { id } });
  }

  public async findExistingPendingBooking(
    userId: string,
    hostelId: string,
  ): Promise<Booking | null> {
    return await this.bookingRepo.findOne({
      where: { userId, hostelId, status: BookingStatus.PENDING },
    });
  }

  public async createBooking(data: Partial<Booking>): Promise<Booking> {
    const booking = this.bookingRepo.create(data);
    return await this.bookingRepo.save(booking);
  }

  public async findBookingsByUser(userId: string): Promise<Booking[]> {
    return await this.bookingRepo.find({
      where: { userId },
      relations: { hostel: true },
      order: { createdAt: 'DESC' },
    });
  }

  public async findBookingsByHostel(hostelId: string): Promise<Booking[]> {
    return this.bookingRepo.find({
      where: { hostelId },
      relations: { user: true, hostel: true },
      order: { createdAt: 'DESC' },
    });
  }

  public async findById(id: string): Promise<Booking | null> {
    return this.bookingRepo.findOne({
      where: { id },
      relations: { user: true, hostel: true },
    });
  }

  public async save(booking: Booking): Promise<Booking> {
    return this.bookingRepo.save(booking);
  }
}
