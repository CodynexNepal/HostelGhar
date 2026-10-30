"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.repository.ts
// PURPOSE: Data access layer for Hostel Bookings with pagination.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingRepository = void 0;
const database_source_1 = require("../../database/database-source");
const booking_entity_1 = require("../../entities/booking/booking.entity");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const booking_enum_1 = require("../../enum/booking.enum");
class BookingRepository {
    constructor() {
        this.bookingRepo = database_source_1.AppDataSource.getRepository(booking_entity_1.Booking);
        this.hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
    }
    async findHostelById(id) {
        return await this.hostelRepo.findOne({ where: { id } });
    }
    async findExistingPendingBooking(userId, hostelId) {
        return await this.bookingRepo.findOne({
            where: { userId, hostelId, status: booking_enum_1.BookingStatus.PENDING },
        });
    }
    async createBooking(data) {
        const booking = this.bookingRepo.create(data);
        return await this.bookingRepo.save(booking);
    }
    async findBookingsByUser(userId, page = 1, limit = 20) {
        return await this.bookingRepo.findAndCount({
            where: { userId },
            relations: { hostel: true },
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
    async findBookingsByHostel(hostelId, page = 1, limit = 20) {
        return await this.bookingRepo.findAndCount({
            where: { hostelId },
            relations: { user: true, hostel: true },
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
    async findById(id) {
        return this.bookingRepo.findOne({
            where: { id },
            relations: { user: true, hostel: true },
        });
    }
    async save(booking) {
        return this.bookingRepo.save(booking);
    }
    async delete(id) {
        await this.bookingRepo.delete(id);
    }
}
exports.BookingRepository = BookingRepository;
