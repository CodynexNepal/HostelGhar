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
import {
  CreateDailyMealDto,
  UpdateDailyMealDto,
  SaveDailyMealsDto,
} from '../../dto/meal/daily-meal.dto';
import { authenticate, optionalAuthenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';

const mealRouter = Router({ mergeParams: true });
const mealController = MealFactory.create();

// ─── Daily Meal Schedule (दैनिक भोजन तालिका) ─────────────────────────────
mealRouter.get(
  '/daily',
  optionalAuthenticate,
  requireParam('hostelId'),
  apiReadLimiter,
  mealController.getDailySchedule,
);

mealRouter.post(
  '/daily',
  authenticate,
  requireParam('hostelId'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  validateDto(CreateDailyMealDto),
  mealController.createDailyMeal,
);

mealRouter.put(
  '/daily/:id',
  authenticate,
  requireParam('hostelId'),
  requireParam('id'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  validateDto(UpdateDailyMealDto),
  mealController.updateDailyMeal,
);

mealRouter.delete(
  '/daily/:id',
  authenticate,
  requireParam('hostelId'),
  requireParam('id'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  mealController.deleteDailyMeal,
);

mealRouter.put(
  '/daily',
  authenticate,
  requireParam('hostelId'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  validateDto(SaveDailyMealsDto),
  mealController.saveDailySchedule,
);

mealRouter.delete(
  '/daily',
  authenticate,
  requireParam('hostelId'),
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  mealController.clearDailySchedule,
);

// ─── Weekly Meal Schedule (Existing Backward Compatible Endpoints) ────────
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
