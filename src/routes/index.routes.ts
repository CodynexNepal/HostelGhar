import { Router } from 'express';
import { authRouter } from './auth/auth.routes';
import { adminRouter } from './admin/admin.routes';
import { ownerRouter } from './owner/owner.routes';
import { residentRouter } from './resident/resident.routes';
import { residentImportRouter } from './import/resident-import.routes';
import { bookingRouter } from './booking/booking.routes';
import { analyticsRouter } from './analytics/analytics.routes';
import { hostelRouter } from './hostel/hostel.routes';
import { leaveRouter } from './leave/leave.routes';
import { feeRouter } from './fee/fee.routes';
import { roomRouter } from './room/room.routes';
import { bedRouter } from './bed/bed.routes';
import { paymentQrRouter } from './payment-qr/payment-qr.routes';
import { paymentProofRouter } from './payment-proof/payment-proof.routes';
import { expenseRouter } from './expense/expense.routes';

const routes = Router();

routes.use('/auth', authRouter);
routes.use('/admin', adminRouter);
routes.use('/owner', ownerRouter);
routes.use('/resident', residentRouter);
routes.use('/owner/resident-imports', residentImportRouter);
routes.use('/bookings', bookingRouter);
routes.use('/analytics', analyticsRouter);
routes.use('/hostels', hostelRouter);
routes.use('/leaves', leaveRouter);
routes.use('/', paymentProofRouter);
routes.use('/fees', feeRouter);
routes.use('/rooms', roomRouter);
routes.use('/beds', bedRouter);
routes.use('/payment-qrs', paymentQrRouter);
routes.use('/expenses', expenseRouter);

export default routes;
