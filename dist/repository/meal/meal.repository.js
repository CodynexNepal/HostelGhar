"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.repository.ts
// PURPOSE: Data access layer for hostel meals and weekly schedules.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealRepository = void 0;
const typeorm_1 = require("typeorm");
const database_source_1 = require("../../database/database-source");
const hostel_meal_entity_1 = require("../../entities/meal/hostel-meal.entity");
const hostel_daily_meal_entity_1 = require("../../entities/meal/hostel-daily-meal.entity");
class MealRepository {
    constructor() {
        this.mealRepo = database_source_1.AppDataSource.getRepository(hostel_meal_entity_1.HostelMeal);
        this.dailyMealRepo = database_source_1.AppDataSource.getRepository(hostel_daily_meal_entity_1.HostelDailyMeal);
    }
    async findByHostelId(hostelId) {
        return this.mealRepo.find({
            where: { hostelId },
            order: { dayOfWeek: 'ASC' },
        });
    }
    async findDailyMealsByHostelId(hostelId, dayOfWeek) {
        const normDay = dayOfWeek ? dayOfWeek.toUpperCase().trim() : undefined;
        if (normDay && normDay !== 'ALL') {
            const specific = await this.dailyMealRepo.find({
                where: { hostelId, dayOfWeek: normDay },
                order: { orderIndex: 'ASC', createdAt: 'ASC' },
            });
            if (specific.length > 0)
                return specific;
        }
        return this.dailyMealRepo.find({
            where: [
                { hostelId, dayOfWeek: 'ALL' },
                { hostelId, dayOfWeek: (0, typeorm_1.IsNull)() },
            ],
            order: { orderIndex: 'ASC', createdAt: 'ASC' },
        });
    }
    async findAllDailyMealsRaw(hostelId) {
        return this.dailyMealRepo.find({
            where: { hostelId },
            order: { dayOfWeek: 'ASC', orderIndex: 'ASC', createdAt: 'ASC' },
        });
    }
    async findDailyMealById(id) {
        return this.dailyMealRepo.findOne({ where: { id } });
    }
    async createDailyMeal(hostelId, data) {
        const meal = this.dailyMealRepo.create({
            hostelId,
            dayOfWeek: (data.dayOfWeek || 'ALL').toUpperCase().trim(),
            mealName: data.mealName.trim(),
            mealNameEn: data.mealNameEn?.trim() || null,
            time: data.time.trim(),
            menuDescription: data.menuDescription?.trim() || null,
            isActive: data.isActive !== undefined ? data.isActive : true,
            orderIndex: data.orderIndex !== undefined ? data.orderIndex : 0,
        });
        return this.dailyMealRepo.save(meal);
    }
    async updateDailyMeal(id, data) {
        const existing = await this.dailyMealRepo.findOne({ where: { id } });
        if (!existing)
            return null;
        if (data.dayOfWeek !== undefined)
            existing.dayOfWeek = data.dayOfWeek.toUpperCase().trim();
        if (data.mealName !== undefined)
            existing.mealName = data.mealName.trim();
        if (data.mealNameEn !== undefined)
            existing.mealNameEn = data.mealNameEn?.trim() || null;
        if (data.time !== undefined)
            existing.time = data.time.trim();
        if (data.menuDescription !== undefined)
            existing.menuDescription = data.menuDescription?.trim() || null;
        if (data.isActive !== undefined)
            existing.isActive = data.isActive;
        if (data.orderIndex !== undefined)
            existing.orderIndex = data.orderIndex;
        return this.dailyMealRepo.save(existing);
    }
    async deleteDailyMeal(id) {
        const result = await this.dailyMealRepo.delete({ id });
        return (result.affected ?? 0) > 0;
    }
    async saveDailyMeals(hostelId, meals, dayOfWeek = 'ALL') {
        const normDay = (dayOfWeek || 'ALL').toUpperCase().trim();
        return database_source_1.AppDataSource.transaction(async (manager) => {
            const repo = manager.getRepository(hostel_daily_meal_entity_1.HostelDailyMeal);
            await repo.delete({ hostelId, dayOfWeek: normDay });
            const entities = meals.map((m, idx) => repo.create({
                hostelId,
                dayOfWeek: normDay,
                mealName: m.mealName.trim(),
                mealNameEn: m.mealNameEn?.trim() || null,
                time: m.time.trim(),
                menuDescription: m.menuDescription?.trim() || null,
                isActive: m.isActive !== undefined ? m.isActive : true,
                orderIndex: m.orderIndex !== undefined ? m.orderIndex : idx + 1,
            }));
            await repo.save(entities);
            return repo.find({
                where: { hostelId, dayOfWeek: normDay },
                order: { orderIndex: 'ASC', createdAt: 'ASC' },
            });
        });
    }
    async clearDailyMeals(hostelId, dayOfWeek) {
        if (dayOfWeek) {
            await this.dailyMealRepo.delete({
                hostelId,
                dayOfWeek: dayOfWeek.toUpperCase().trim(),
            });
        }
        else {
            await this.dailyMealRepo.delete({ hostelId });
        }
    }
    async saveWeeklySchedule(hostelId, mealInputs) {
        return database_source_1.AppDataSource.transaction(async (manager) => {
            const repo = manager.getRepository(hostel_meal_entity_1.HostelMeal);
            for (const input of mealInputs) {
                let existing = await repo.findOne({
                    where: { hostelId, dayOfWeek: input.dayOfWeek },
                });
                const breakfastDesc = input.breakfastDescription?.trim() || null;
                const breakfastTime = input.breakfastTime?.trim() || null;
                const breakfastNotes = input.breakfastNotes?.trim() || null;
                const mainDesc = input.mainMealDescription?.trim() || null;
                const mainTime = input.mainMealTime?.trim() || null;
                const mainNotes = input.mainMealNotes?.trim() || null;
                if (existing) {
                    existing.breakfastDescription = breakfastDesc;
                    existing.breakfastTime = breakfastTime;
                    existing.breakfastNotes = breakfastNotes;
                    existing.mainMealDescription = mainDesc;
                    existing.mainMealTime = mainTime;
                    existing.mainMealNotes = mainNotes;
                    await repo.save(existing);
                }
                else {
                    const newMeal = repo.create({
                        hostelId,
                        dayOfWeek: input.dayOfWeek,
                        breakfastDescription: breakfastDesc,
                        breakfastTime,
                        breakfastNotes,
                        mainMealDescription: mainDesc,
                        mainMealTime: mainTime,
                        mainMealNotes: mainNotes,
                    });
                    await repo.save(newMeal);
                }
            }
            return repo.find({
                where: { hostelId },
            });
        });
    }
    async clearSchedule(hostelId) {
        await this.mealRepo.delete({ hostelId });
    }
}
exports.MealRepository = MealRepository;
