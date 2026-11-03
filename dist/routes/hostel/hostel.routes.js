"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hostelRouter = void 0;
const express_1 = require("express");
const hostel_factory_1 = require("../../factory/hostel/hostel.factory");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
const http_decorator_1 = require("../../decorators/http.decorator");
const facility_routes_1 = require("../facility/facility.routes");
const meal_routes_1 = require("../meal/meal.routes");
const location_routes_1 = require("../location/location.routes");
const hostel_like_repository_1 = require("../../repository/like/hostel-like.repository");
const hostel_like_service_1 = require("../../services/like/hostel-like.service");
const hostel_like_controller_1 = require("../../controller/like/hostel-like.controller");
const hostel_listing_service_1 = require("../../services/hostel-listing/hostel-listing.service");
const hostel_listing_controller_1 = require("../../controller/hostel-listing/hostel-listing.controller");
const hostelRouter = (0, express_1.Router)();
exports.hostelRouter = hostelRouter;
const hostelController = hostel_factory_1.HostelFactory.create();
const likeRepository = new hostel_like_repository_1.HostelLikeRepository();
const likeService = new hostel_like_service_1.HostelLikeService(likeRepository);
const likeController = new hostel_like_controller_1.HostelLikeController(likeService);
const listingService = new hostel_listing_service_1.HostelListingService();
const listingController = new hostel_listing_controller_1.HostelListingController(listingService);
// Public routes (accessible without authentication)
hostelRouter.get('/', rateLimiter_config_1.apiReadLimiter, hostelController.listHostels);
// Specific action routes mounted before /:id parameterized routes
hostelRouter.post('/listing-request', listingController.submit);
hostelRouter.get('/listing-requests', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN), listingController.list);
hostelRouter.get('/user/likes', auth_middleware_1.optionalAuthenticate, likeController.getUserLikedHostels);
// Nested facility routes — hostel id comes from :hostelId PARAM.
// Mounted before generic /:id so /:hostelId/facilities never collides.
// Public for GET; mutations (PUT/POST/DELETE) are protected inside facilityRouter.
hostelRouter.use('/:hostelId/facilities', facility_routes_1.facilityRouter);
hostelRouter.use('/:hostelId/meals', meal_routes_1.mealRouter);
hostelRouter.use('/:hostelId/location', location_routes_1.locationRouter);
// Public hostel detail by ID
hostelRouter.get('/:id', (0, http_decorator_1.requireParam)('id'), rateLimiter_config_1.apiReadLimiter, hostelController.getHostel);
// Likes endpoints
hostelRouter.post('/:id/like', auth_middleware_1.optionalAuthenticate, (0, http_decorator_1.requireParam)('id'), likeController.toggleLike);
hostelRouter.get('/:id/like-stats', auth_middleware_1.optionalAuthenticate, (0, http_decorator_1.requireParam)('id'), likeController.getHostelLikeStats);
// Ratings endpoints
hostelRouter.get('/:id/ratings', (0, http_decorator_1.requireParam)('id'), rateLimiter_config_1.apiReadLimiter, hostelController.getRatings);
hostelRouter.post('/:id/ratings', auth_middleware_1.optionalAuthenticate, (0, http_decorator_1.requireParam)('id'), hostelController.addRating);
// Protected routes (require authentication)
hostelRouter.get('/:id/residents', auth_middleware_1.authenticate, (0, http_decorator_1.requireParam)('id'), (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN, roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.RESIDENT), hostelController.getResidents);
hostelRouter.get('/:id/leave-types', auth_middleware_1.authenticate, (0, http_decorator_1.requireParam)('id'), hostelController.getLeaveTypes);
