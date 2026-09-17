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
import { requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';

const facilityRouter = Router({ mergeParams: true });
const facilityController = FacilityFactory.create();

// NOTE: parent hostelRouter already runs `authenticate` — do NOT repeat it
// here (would verify the JWT twice per request).

facilityRouter.get('/', requireParam('hostelId'), apiReadLimiter, facilityController.list);

facilityRouter.put(
  '/',
  requireParam('hostelId'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  validateDto(SyncHostelFacilitiesDto),
  facilityController.sync,
);

facilityRouter.post(
  '/',
  requireParam('hostelId'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  validateDto(UpsertFacilityItemDto),
  facilityController.add,
);

facilityRouter.delete(
  '/:facilityKey',
  requireParam('hostelId'),
  requireParam('facilityKey'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  facilityController.remove,
);

export { facilityRouter };
