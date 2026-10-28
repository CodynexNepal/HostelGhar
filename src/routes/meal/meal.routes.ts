// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.routes.ts
// PURPOSE: Routes for managing weekly meal schedules:
//          GET    /hostels/:hostelId/meals (Public or authenticated)
//          PUT    /hostels/:hostelId/meals (Protected: Owner/Admin)
//          DELETE /hostels/:hostelId/meals (Protected: Owner/Admin)
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { MealFactory } from '../../factory/meal/meal.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { SaveWeeklyMealsDto } from '../../dto/meal/meal.dto';
import { authenticate, optionalAuthenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';

const mealRouter = Router({ mergeParams: true });
const mealController = MealFactory.create();

// Public / Authenticated read
mealRouter.get(
  '/',
  optionalAuthenticate,
  requireParam('hostelId'),
  apiReadLimiter,
  mealController.getSchedule,
);

// Protected mutations
mealRouter.put(
  '/',
  authenticate,
  requireParam('hostelId'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  validateDto(SaveWeeklyMealsDto),
  mealController.saveSchedule,
);

mealRouter.delete(
  '/',
  authenticate,
  requireParam('hostelId'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  mealController.clearSchedule,
);

export { mealRouter };
