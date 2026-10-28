"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.routes.ts
// PURPOSE: Routes for managing weekly meal schedules:
//          GET    /hostels/:hostelId/meals (Public or authenticated)
//          PUT    /hostels/:hostelId/meals (Protected: Owner/Admin)
//          DELETE /hostels/:hostelId/meals (Protected: Owner/Admin)
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealRouter = void 0;
const express_1 = require("express");
const meal_factory_1 = require("../../factory/meal/meal.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const meal_dto_1 = require("../../dto/meal/meal.dto");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
const http_decorator_1 = require("../../decorators/http.decorator");
const mealRouter = (0, express_1.Router)({ mergeParams: true });
exports.mealRouter = mealRouter;
const mealController = meal_factory_1.MealFactory.create();
// Public / Authenticated read
mealRouter.get('/', auth_middleware_1.optionalAuthenticate, (0, http_decorator_1.requireParam)('hostelId'), rateLimiter_config_1.apiReadLimiter, mealController.getSchedule);
// Protected mutations
mealRouter.put('/', auth_middleware_1.authenticate, (0, http_decorator_1.requireParam)('hostelId'), (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, validate_dto_middleware_1.validateDto)(meal_dto_1.SaveWeeklyMealsDto), mealController.saveSchedule);
mealRouter.delete('/', auth_middleware_1.authenticate, (0, http_decorator_1.requireParam)('hostelId'), (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), mealController.clearSchedule);
