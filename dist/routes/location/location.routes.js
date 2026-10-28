"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: location.routes.ts
// PURPOSE: Routes for managing and viewing hostel geographic location:
//          GET  /hostels/:hostelId/location (Public respects isLocationShared; Owner/Admin views saved state)
//          PUT  /hostels/:hostelId/location (Protected: Owner/Admin)
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.locationRouter = void 0;
const express_1 = require("express");
const location_factory_1 = require("../../factory/location/location.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const location_dto_1 = require("../../dto/location/location.dto");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
const http_decorator_1 = require("../../decorators/http.decorator");
const locationRouter = (0, express_1.Router)({ mergeParams: true });
exports.locationRouter = locationRouter;
const locationController = location_factory_1.LocationFactory.create();
// Public / Authenticated read
locationRouter.get('/', auth_middleware_1.optionalAuthenticate, (0, http_decorator_1.requireParam)('hostelId'), rateLimiter_config_1.apiReadLimiter, locationController.getLocation);
// Protected mutation
locationRouter.put('/', auth_middleware_1.authenticate, (0, http_decorator_1.requireParam)('hostelId'), (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, validate_dto_middleware_1.validateDto)(location_dto_1.UpdateHostelLocationDto), locationController.updateLocation);
