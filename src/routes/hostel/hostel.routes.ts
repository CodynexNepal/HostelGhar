import { Router } from 'express';
import { HostelFactory } from '../../factory/hostel/hostel.factory';
import { authenticate, optionalAuthenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';
import { facilityRouter } from '../facility/facility.routes';

const hostelRouter = Router();
const hostelController = HostelFactory.create();

// Public routes (accessible without authentication)
hostelRouter.get('/', apiReadLimiter, hostelController.listHostels);

// Nested facility routes — hostel id comes from :hostelId PARAM.
// Mounted before generic /:id so /:hostelId/facilities never collides.
// Public for GET; mutations (PUT/POST/DELETE) are protected inside facilityRouter.
hostelRouter.use('/:hostelId/facilities', facilityRouter);

// Public hostel detail by ID
hostelRouter.get('/:id', requireParam('id'), apiReadLimiter, hostelController.getHostel);

// Ratings endpoints
hostelRouter.get('/:id/ratings', requireParam('id'), apiReadLimiter, hostelController.getRatings);
hostelRouter.post(
  '/:id/ratings',
  optionalAuthenticate,
  requireParam('id'),
  hostelController.addRating,
);

// Protected routes (require authentication)
hostelRouter.get(
  '/:id/residents',
  authenticate,
  requireParam('id'),
  requireRoles(IROLES.ADMIN, IROLES.OWNER, IROLES.RESIDENT),
  hostelController.getResidents,
);
hostelRouter.get(
  '/:id/leave-types',
  authenticate,
  requireParam('id'),
  hostelController.getLeaveTypes,
);

export { hostelRouter };
