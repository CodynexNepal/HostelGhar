"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.repository.ts
// PURPOSE: Data access layer for hostel meals and weekly schedules.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealRepository = void 0;
const database_source_1 = require("../../database/database-source");
const hostel_meal_entity_1 = require("../../entities/meal/hostel-meal.entity");
class MealRepository {
    constructor() {
        this.mealRepo = database_source_1.AppDataSource.getRepository(hostel_meal_entity_1.HostelMeal);
    }
    async findByHostelId(hostelId) {
        return this.mealRepo.find({
            where: { hostelId },
            order: { dayOfWeek: 'ASC' },
        });
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
