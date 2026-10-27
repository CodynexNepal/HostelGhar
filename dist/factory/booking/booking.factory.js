"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingFactory = void 0;
const booking_controller_1 = require("../../controller/booking/booking.controller");
const booking_repository_1 = require("../../repository/booking/booking.repository");
const booking_service_1 = require("../../services/booking/booking.service");
class BookingFactory {
    constructor() { }
    static create() {
        const bookingRepository = new booking_repository_1.BookingRepository();
        const bookingService = new booking_service_1.BookingService(bookingRepository);
        return new booking_controller_1.BookingController(bookingService);
    }
}
exports.BookingFactory = BookingFactory;
