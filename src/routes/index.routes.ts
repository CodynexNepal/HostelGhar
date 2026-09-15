import { Router } from 'express';
import { authRouter } from './auth/auth.routes';
import { adminRouter } from './admin/admin.routes';
import { ownerRouter } from './owner/owner.routes';
import { residentRouter } from './resident/resident.routes';
import { bookingRouter } from './booking/booking.routes';
import { analyticsRouter } from './analytics/analytics.routes';
import { hostelRouter } from './hostel/hostel.routes';
import { leaveRouter } from './leave/leave.routes';
import { feeRouter } from './fee/fee.routes';
import { roomRouter } from './room/room.routes';

const routes = Router();

routes.use('/auth', authRouter);
routes.use('/admin', adminRouter);
routes.use('/owner', ownerRouter);
routes.use('/resident', residentRouter);
routes.use('/bookings', bookingRouter);
routes.use('/analytics', analyticsRouter);
routes.use('/hostels', hostelRouter);
routes.use('/leaves', leaveRouter);
routes.use('/fees', feeRouter);
routes.use('/rooms', roomRouter);

export default routes;
