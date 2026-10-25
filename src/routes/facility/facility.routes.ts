// ─────────────────────────────────────────────────────────────
// FILE: facility.routes.ts
// PURPOSE: Reliable nested routes — hostel id from :hostelId PARAM.
//  GET    /hostels/:hostelId/facilities
//  PUT    /hostels/:hostelId/facilities          (full sync)
//  POST   /hostels/:hostelId/facilities          (add one)
//  DELETE /hostels/:hostelId/facilities/:facilityKey
// ─────────────────────────────────────────────────────────────
import { Router } from 'express';
import { FacilityFactory } from '../../factory/facility/facility.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { SyncHostelFacilitiesDto, UpsertFacilityItemDto } from '../../dto/facility/facility.dto';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';

const facilityRouter = Router({ mergeParams: true });
const facilityController = FacilityFactory.create();

// Public route — anyone can view facilities of a hostel without logging in.
facilityRouter.get('/', requireParam('hostelId'), apiReadLimiter, facilityController.list);

// Protected mutation routes — require authentication and OWNER/ADMIN role.
facilityRouter.put(
  '/',
  authenticate,
  requireParam('hostelId'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  validateDto(SyncHostelFacilitiesDto),
  facilityController.sync,
);

facilityRouter.post(
  '/',
  authenticate,
  requireParam('hostelId'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  validateDto(UpsertFacilityItemDto),
  facilityController.add,
);

facilityRouter.delete(
  '/:facilityKey',
  authenticate,
  requireParam('hostelId'),
  requireParam('facilityKey'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  facilityController.remove,
);

export { facilityRouter };
