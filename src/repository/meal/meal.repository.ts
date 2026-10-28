// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.repository.ts
// PURPOSE: Data access layer for hostel meals and weekly schedules.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { HostelMeal } from '../../entities/meal/hostel-meal.entity';
import { DayOfWeek, DAYS_OF_WEEK_ORDER } from '../../enum/meal.enum';

export interface MealDayInput {
  dayOfWeek: DayOfWeek;
  breakfastDescription?: string | null;
  breakfastTime?: string | null;
  breakfastNotes?: string | null;
  mainMealDescription?: string | null;
  mainMealTime?: string | null;
  mainMealNotes?: string | null;
}

export class MealRepository {
  private readonly mealRepo: Repository<HostelMeal>;

  constructor() {
    this.mealRepo = AppDataSource.getRepository(HostelMeal);
  }

  public async findByHostelId(hostelId: string): Promise<HostelMeal[]> {
    return this.mealRepo.find({
      where: { hostelId },
      order: { dayOfWeek: 'ASC' },
    });
  }

  public async saveWeeklySchedule(
    hostelId: string,
    mealInputs: MealDayInput[],
  ): Promise<HostelMeal[]> {
    return AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(HostelMeal);

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
        } else {
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

  public async clearSchedule(hostelId: string): Promise<void> {
    await this.mealRepo.delete({ hostelId });
  }
}
