"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.facilityRouter = void 0;
// ─────────────────────────────────────────────────────────────
// FILE: facility.routes.ts
// PURPOSE: Reliable nested routes — hostel id from :hostelId PARAM.
//  GET    /hostels/:hostelId/facilities
//  PUT    /hostels/:hostelId/facilities          (full sync)
//  POST   /hostels/:hostelId/facilities          (add one)
//  DELETE /hostels/:hostelId/facilities/:facilityKey
// ─────────────────────────────────────────────────────────────
const express_1 = require("express");
const facility_factory_1 = require("../../factory/facility/facility.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const facility_dto_1 = require("../../dto/facility/facility.dto");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
const http_decorator_1 = require("../../decorators/http.decorator");
const facilityRouter = (0, express_1.Router)({ mergeParams: true });
exports.facilityRouter = facilityRouter;
const facilityController = facility_factory_1.FacilityFactory.create();
// Public route — anyone can view facilities of a hostel without logging in.
facilityRouter.get('/', (0, http_decorator_1.requireParam)('hostelId'), rateLimiter_config_1.apiReadLimiter, facilityController.list);
// Protected mutation routes — require authentication and OWNER/ADMIN role.
facilityRouter.put('/', auth_middleware_1.authenticate, (0, http_decorator_1.requireParam)('hostelId'), (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, validate_dto_middleware_1.validateDto)(facility_dto_1.SyncHostelFacilitiesDto), facilityController.sync);
facilityRouter.post('/', auth_middleware_1.authenticate, (0, http_decorator_1.requireParam)('hostelId'), (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, validate_dto_middleware_1.validateDto)(facility_dto_1.UpsertFacilityItemDto), facilityController.add);
facilityRouter.delete('/:facilityKey', auth_middleware_1.authenticate, (0, http_decorator_1.requireParam)('hostelId'), (0, http_decorator_1.requireParam)('facilityKey'), (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), facilityController.remove);
