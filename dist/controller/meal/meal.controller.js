"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.controller.ts
// PURPOSE: HTTP layer for weekly meals schedule endpoints.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
class MealController {
    constructor(mealService) {
        this.mealService = mealService;
        this.getSchedule = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const user = req.user
                    ? {
                        userId: req.user.userId,
                        role: req.user.role ?? '',
                    }
                    : undefined;
                const result = await this.mealService.getWeeklySchedule(hostelId, user);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.saveSchedule = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const user = {
                    userId: req.user.userId,
                    role: req.user.role ?? '',
                };
                const dto = req.body;
                const rawMeals = Array.isArray(dto.meals) ? dto.meals : [];
                const isDailyMealPayload = rawMeals.some((m) => m && (m.mealName !== undefined || m.time !== undefined));
                if (isDailyMealPayload) {
                    const dayOfWeek = (req.body?.dayOfWeek ||
                        req.query.dayOfWeek ||
                        req.query.day ||
                        'ALL');
                    const result = await this.mealService.saveDailySchedule(hostelId, user, rawMeals, dayOfWeek);
                    if (result.error) {
                        res.status(result.error.status).json({ success: false, message: result.error.message });
                        return;
                    }
                    res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                        success: true,
                        message: 'Daily meal schedule saved successfully',
                        data: result.data,
                    });
                    return;
                }
                // Filter to ensure only weekly items with a valid dayOfWeek are saved
                const weeklyMeals = rawMeals
                    .filter((m) => m && m.dayOfWeek)
                    .map((m) => ({
                    dayOfWeek: m.dayOfWeek,
                    breakfastDescription: m.breakfastDescription ?? null,
                    breakfastTime: m.breakfastTime ?? null,
                    breakfastNotes: m.breakfastNotes ?? null,
                    mainMealDescription: m.mainMealDescription ?? null,
                    mainMealTime: m.mainMealTime ?? null,
                    mainMealNotes: m.mainMealNotes ?? null,
                }));
                const result = await this.mealService.saveWeeklySchedule(hostelId, user, weeklyMeals);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Weekly meal schedule saved successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.clearSchedule = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const user = {
                    userId: req.user.userId,
                    role: req.user.role ?? '',
                };
                const result = await this.mealService.clearWeeklySchedule(hostelId, user);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Weekly meal schedule cleared successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        // ─── DAILY MEAL SCHEDULE HANDLERS (दैनिक भोजन तालिका) ─────────────────────
        this.getDailySchedule = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const user = req.user
                    ? {
                        userId: req.user.userId,
                        role: req.user.role ?? '',
                    }
                    : undefined;
                const dayOfWeek = (req.query.dayOfWeek || req.query.day);
                const result = await this.mealService.getDailySchedule(hostelId, user, dayOfWeek);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.createDailyMeal = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const user = {
                    userId: req.user.userId,
                    role: req.user.role ?? '',
                };
                const result = await this.mealService.createDailyMeal(hostelId, user, req.body);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: 'Daily meal item created successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateDailyMeal = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const mealId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const user = {
                    userId: req.user.userId,
                    role: req.user.role ?? '',
                };
                const result = await this.mealService.updateDailyMeal(hostelId, mealId, user, req.body);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Daily meal item updated successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.deleteDailyMeal = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const mealId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const user = {
                    userId: req.user.userId,
                    role: req.user.role ?? '',
                };
                const result = await this.mealService.deleteDailyMeal(hostelId, mealId, user);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Daily meal item deleted successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.saveDailySchedule = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const user = {
                    userId: req.user.userId,
                    role: req.user.role ?? '',
                };
                const meals = Array.isArray(req.body?.meals) ? req.body.meals : req.body;
                const dayOfWeek = (req.body?.dayOfWeek ||
                    req.query.dayOfWeek ||
                    req.query.day ||
                    'ALL');
                const result = await this.mealService.saveDailySchedule(hostelId, user, meals, dayOfWeek);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Daily meal schedule saved successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.clearDailySchedule = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const user = {
                    userId: req.user.userId,
                    role: req.user.role ?? '',
                };
                const dayOfWeek = (req.query.dayOfWeek || req.query.day);
                const result = await this.mealService.clearDailySchedule(hostelId, user, dayOfWeek);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Daily meal schedule cleared successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.MealController = MealController;
