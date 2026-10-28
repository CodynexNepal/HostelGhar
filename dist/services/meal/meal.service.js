"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.service.ts
// PURPOSE: Business logic, validation, caching, and authorization for hostel meals.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealService = exports.isUuidV4 = void 0;
const database_source_1 = require("../../database/database-source");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const meal_enum_1 = require("../../enum/meal.enum");
const roles_enum_1 = require("../../enum/roles.enum");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const cache_util_1 = require("../../utils/cache.util");
const meal_repository_1 = require("../../repository/meal/meal.repository");
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuidV4 = (v) => typeof v === 'string' && UUID_V4.test(v.trim());
exports.isUuidV4 = isUuidV4;
class MealService {
    constructor(repo = new meal_repository_1.MealRepository()) {
        this.repo = repo;
    }
    key(hostelId) {
        return cache_util_1.cacheService.generateKey('hostel:meals', { hostelId, v: 1 });
    }
    async invalidate(hostelId) {
        await cache_util_1.cacheService.invalidatePattern('hostel:meals');
        await cache_util_1.cacheService.invalidatePattern('public:hostel');
        await cache_util_1.cacheService.invalidatePattern('hostels');
        await cache_util_1.cacheService.invalidate(this.key(hostelId)).catch(() => undefined);
    }
    async verifyHostelOwner(hostelId, user) {
        const hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        const hostel = await hostelRepo.findOne({
            where: { id: hostelId },
            select: { id: true, ownerId: true, isActive: true },
        });
        if (!hostel) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' },
            };
        }
        const role = user.role?.toLowerCase();
        if (role === roles_enum_1.IROLES.ADMIN) {
            return { hostel };
        }
        if (role === roles_enum_1.IROLES.OWNER) {
            if (hostel.ownerId !== user.userId) {
                return {
                    error: {
                        status: statusCode_interface_1.STATUS_CODE.FORBIDDEN,
                        message: 'You do not own or have permission to manage this hostel',
                    },
                };
            }
            return { hostel };
        }
        return {
            error: {
                status: statusCode_interface_1.STATUS_CODE.FORBIDDEN,
                message: 'Access denied: only hostel owners or administrators can manage meals',
            },
        };
    }
    formatSchedule(hostelId, rawMeals) {
        const mealMap = new Map();
        let maxUpdated = null;
        let hasAnyConfigured = false;
        for (const m of rawMeals) {
            mealMap.set(m.dayOfWeek, m);
            if (m.updatedAt) {
                if (!maxUpdated || new Date(m.updatedAt) > new Date(maxUpdated)) {
                    maxUpdated = m.updatedAt;
                }
            }
            if ((m.breakfastDescription && m.breakfastDescription.trim().length > 0) ||
                (m.mainMealDescription && m.mainMealDescription.trim().length > 0)) {
                hasAnyConfigured = true;
            }
        }
        const schedule = meal_enum_1.DAYS_OF_WEEK_ORDER.map((day) => {
            const found = mealMap.get(day);
            if (found) {
                return {
                    id: found.id,
                    dayOfWeek: day,
                    breakfastDescription: found.breakfastDescription,
                    breakfastTime: found.breakfastTime,
                    breakfastNotes: found.breakfastNotes,
                    mainMealDescription: found.mainMealDescription,
                    mainMealTime: found.mainMealTime,
                    mainMealNotes: found.mainMealNotes,
                    createdAt: found.createdAt,
                    updatedAt: found.updatedAt,
                };
            }
            return {
                id: null,
                dayOfWeek: day,
                breakfastDescription: null,
                breakfastTime: null,
                breakfastNotes: null,
                mainMealDescription: null,
                mainMealTime: null,
                mainMealNotes: null,
                createdAt: null,
                updatedAt: null,
            };
        });
        return {
            hostelId,
            hasSchedule: hasAnyConfigured,
            lastUpdatedAt: maxUpdated,
            schedule,
        };
    }
    async getWeeklySchedule(hostelId, user) {
        if (!(0, exports.isUuidV4)(hostelId)) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
            };
        }
        const hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        const hostel = await hostelRepo.findOne({
            where: { id: hostelId },
            select: { id: true, ownerId: true, isActive: true },
        });
        if (!hostel) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' },
            };
        }
        // If authenticated owner/admin, allow access regardless of isActive
        if (user) {
            const authCheck = await this.verifyHostelOwner(hostelId, user);
            if (authCheck.error) {
                return { error: authCheck.error };
            }
        }
        else {
            // Public access requires active hostel
            if (!hostel.isActive) {
                return {
                    error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel is inactive or not found' },
                };
            }
        }
        const cacheKey = this.key(hostelId);
        const { data } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const rawMeals = await this.repo.findByHostelId(hostelId);
            return this.formatSchedule(hostelId, rawMeals);
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return { data };
    }
    async saveWeeklySchedule(hostelId, user, meals) {
        if (!(0, exports.isUuidV4)(hostelId)) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
            };
        }
        const authCheck = await this.verifyHostelOwner(hostelId, user);
        if (authCheck.error) {
            return { error: authCheck.error };
        }
        // Save schedule in transaction
        const saved = await this.repo.saveWeeklySchedule(hostelId, meals);
        await this.invalidate(hostelId);
        const formatted = this.formatSchedule(hostelId, saved);
        return { data: formatted };
    }
    async clearWeeklySchedule(hostelId, user) {
        if (!(0, exports.isUuidV4)(hostelId)) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
            };
        }
        const authCheck = await this.verifyHostelOwner(hostelId, user);
        if (authCheck.error) {
            return { error: authCheck.error };
        }
        await this.repo.clearSchedule(hostelId);
        await this.invalidate(hostelId);
        const empty = this.formatSchedule(hostelId, []);
        return { data: empty };
    }
}
exports.MealService = MealService;
