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
const hostelRouter = (0, express_1.Router)();
exports.hostelRouter = hostelRouter;
const hostelController = hostel_factory_1.HostelFactory.create();
// Public routes (accessible without authentication)
hostelRouter.get('/', rateLimiter_config_1.apiReadLimiter, hostelController.listHostels);
// Nested facility routes — hostel id comes from :hostelId PARAM.
// Mounted before generic /:id so /:hostelId/facilities never collides.
// Public for GET; mutations (PUT/POST/DELETE) are protected inside facilityRouter.
hostelRouter.use('/:hostelId/facilities', facility_routes_1.facilityRouter);
// Public hostel detail by ID
hostelRouter.get('/:id', (0, http_decorator_1.requireParam)('id'), rateLimiter_config_1.apiReadLimiter, hostelController.getHostel);
// Ratings endpoints
hostelRouter.get('/:id/ratings', (0, http_decorator_1.requireParam)('id'), rateLimiter_config_1.apiReadLimiter, hostelController.getRatings);
hostelRouter.post('/:id/ratings', auth_middleware_1.optionalAuthenticate, (0, http_decorator_1.requireParam)('id'), hostelController.addRating);
// Protected routes (require authentication)
hostelRouter.get('/:id/residents', auth_middleware_1.authenticate, (0, http_decorator_1.requireParam)('id'), (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.ADMIN, roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.RESIDENT), hostelController.getResidents);
hostelRouter.get('/:id/leave-types', auth_middleware_1.authenticate, (0, http_decorator_1.requireParam)('id'), hostelController.getLeaveTypes);
