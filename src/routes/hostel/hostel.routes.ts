import { Router } from 'express';
import { HostelFactory } from '../../factory/hostel/hostel.factory';
import { authenticate, optionalAuthenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';
import { facilityRouter } from '../facility/facility.routes';
import { mealRouter } from '../meal/meal.routes';
import { locationRouter } from '../location/location.routes';
import { HostelLikeRepository } from '../../repository/like/hostel-like.repository';
import { HostelLikeService } from '../../services/like/hostel-like.service';
import { HostelLikeController } from '../../controller/like/hostel-like.controller';
import { HostelListingService } from '../../services/hostel-listing/hostel-listing.service';
import { HostelListingController } from '../../controller/hostel-listing/hostel-listing.controller';

const hostelRouter = Router();
const hostelController = HostelFactory.create();

const likeRepository = new HostelLikeRepository();
const likeService = new HostelLikeService(likeRepository);
const likeController = new HostelLikeController(likeService);

const listingService = new HostelListingService();
const listingController = new HostelListingController(listingService);

// Public routes (accessible without authentication)
hostelRouter.get('/', apiReadLimiter, hostelController.listHostels);

// Specific action routes mounted before /:id parameterized routes
hostelRouter.post('/listing-request', listingController.submit);
hostelRouter.get(
  '/listing-requests',
  authenticate,
  requireRoles(IROLES.ADMIN),
  listingController.list,
);
hostelRouter.patch(
  '/listing-requests/:id/status',
  authenticate,
  requireRoles(IROLES.ADMIN),
  listingController.updateStatus,
);
hostelRouter.delete(
  '/listing-requests/:id',
  authenticate,
  requireRoles(IROLES.ADMIN),
  listingController.delete,
);
hostelRouter.get('/user/likes', optionalAuthenticate, likeController.getUserLikedHostels);

// Nested facility routes — hostel id comes from :hostelId PARAM.
// Mounted before generic /:id so /:hostelId/facilities never collides.
// Public for GET; mutations (PUT/POST/DELETE) are protected inside facilityRouter.
hostelRouter.use('/:hostelId/facilities', facilityRouter);
hostelRouter.use('/:hostelId/meals', mealRouter);
hostelRouter.use('/:hostelId/location', locationRouter);

// Public hostel detail by ID
hostelRouter.get('/:id', requireParam('id'), apiReadLimiter, hostelController.getHostel);

// Likes endpoints
hostelRouter.post('/:id/like', optionalAuthenticate, requireParam('id'), likeController.toggleLike);
hostelRouter.get(
  '/:id/like-stats',
  optionalAuthenticate,
  requireParam('id'),
  likeController.getHostelLikeStats,
);

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
