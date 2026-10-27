"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.routes.ts
// PURPOSE: Booking endpoints restricted to role 'USER' only.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingRouter = void 0;
const express_1 = require("express");
const booking_factory_1 = require("../../factory/booking/booking.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const create_booking_dto_1 = require("../../dto/booking/create-booking.dto");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
const idempotency_decorator_1 = require("../../decorators/idempotency.decorator");
const http_decorator_1 = require("../../decorators/http.decorator");
const bookingRouter = (0, express_1.Router)();
exports.bookingRouter = bookingRouter;
const bookingController = booking_factory_1.BookingFactory.create();
bookingRouter.use(auth_middleware_1.authenticate);
bookingRouter.post('/', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.USER), rateLimiter_config_1.bookingCreationLimiter, (0, idempotency_decorator_1.idempotencyKey)(), (0, validate_dto_middleware_1.validateDto)(create_booking_dto_1.CreateBookingDto), bookingController.bookHostel);
bookingRouter.get('/my-bookings', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.USER), bookingController.getMyBookings);
bookingRouter.get('/hostels/:hostelId', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('hostelId'), bookingController.getHostelBookings);
bookingRouter.patch('/:id/status', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('id'), bookingController.updateStatus);
bookingRouter.delete('/:id', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.USER), (0, http_decorator_1.requireParam)('id'), bookingController.cancelBooking);
