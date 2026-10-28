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
                const result = await this.mealService.saveWeeklySchedule(hostelId, user, dto.meals);
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
    }
}
exports.MealController = MealController;
