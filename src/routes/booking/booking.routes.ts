// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.routes.ts
// PURPOSE: Booking endpoints restricted to role 'USER' only.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { BookingFactory } from '../../factory/booking/booking.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreateBookingDto } from '../../dto/booking/create-booking.dto';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { bookingCreationLimiter } from '../../configs/rateLimiter.config';
import { idempotencyKey } from '../../decorators/idempotency.decorator';
import { requireParam } from '../../decorators/http.decorator';

const bookingRouter: Router = Router();
const bookingController = BookingFactory.create();

bookingRouter.use(authenticate);

bookingRouter.post(
  '/',
  requireRoles(IROLES.USER),
  bookingCreationLimiter,
  idempotencyKey(),
  validateDto(CreateBookingDto),
  bookingController.bookHostel,
);
bookingRouter.get('/my-bookings', requireRoles(IROLES.USER), bookingController.getMyBookings);
bookingRouter.get(
  '/hostels/:hostelId',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('hostelId'),
  bookingController.getHostelBookings,
);
bookingRouter.patch(
  '/:id/status',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('id'),
  bookingController.updateStatus,
);
bookingRouter.delete(
  '/:id',
  requireRoles(IROLES.USER),
  requireParam('id'),
  bookingController.cancelBooking,
);

export { bookingRouter };
