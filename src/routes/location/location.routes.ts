// ──────────────────────────────────────────────────────────────────────────────
// FILE: location.routes.ts
// PURPOSE: Routes for managing and viewing hostel geographic location:
//          GET  /hostels/:hostelId/location (Public respects isLocationShared; Owner/Admin views saved state)
//          PUT  /hostels/:hostelId/location (Protected: Owner/Admin)
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { LocationFactory } from '../../factory/location/location.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { UpdateHostelLocationDto } from '../../dto/location/location.dto';
import { authenticate, optionalAuthenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';

const locationRouter = Router({ mergeParams: true });
const locationController = LocationFactory.create();

// Public / Authenticated read
locationRouter.get(
  '/',
  optionalAuthenticate,
  requireParam('hostelId'),
  apiReadLimiter,
  locationController.getLocation,
);

// Protected mutation
locationRouter.put(
  '/',
  authenticate,
  requireParam('hostelId'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  validateDto(UpdateHostelLocationDto),
  locationController.updateLocation,
);

export { locationRouter };

