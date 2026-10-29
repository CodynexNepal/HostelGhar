// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.repository.ts
// PURPOSE: Data access layer for hostel meals and weekly schedules.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { HostelMeal } from '../../entities/meal/hostel-meal.entity';
import { HostelDailyMeal } from '../../entities/meal/hostel-daily-meal.entity';
import { DayOfWeek } from '../../enum/meal.enum';

export interface MealDayInput {
  dayOfWeek: DayOfWeek;
  breakfastDescription?: string | null;
  breakfastTime?: string | null;
  breakfastNotes?: string | null;
  mainMealDescription?: string | null;
  mainMealTime?: string | null;
  mainMealNotes?: string | null;
}

export interface DailyMealInput {
  id?: string;
  mealName: string;
  mealNameEn?: string | null;
  time: string;
  menuDescription?: string | null;
  isActive?: boolean;
  orderIndex?: number;
}

export class MealRepository {
  private readonly mealRepo: Repository<HostelMeal>;
  private readonly dailyMealRepo: Repository<HostelDailyMeal>;

  constructor() {
    this.mealRepo = AppDataSource.getRepository(HostelMeal);
    this.dailyMealRepo = AppDataSource.getRepository(HostelDailyMeal);
  }

  public async findByHostelId(hostelId: string): Promise<HostelMeal[]> {
    return this.mealRepo.find({
      where: { hostelId },
      order: { dayOfWeek: 'ASC' },
    });
  }

  public async findDailyMealsByHostelId(hostelId: string): Promise<HostelDailyMeal[]> {
    return this.dailyMealRepo.find({
      where: { hostelId },
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
    });
  }

  public async findDailyMealById(id: string): Promise<HostelDailyMeal | null> {
    return this.dailyMealRepo.findOne({ where: { id } });
  }

  public async createDailyMeal(hostelId: string, data: DailyMealInput): Promise<HostelDailyMeal> {
    const meal = this.dailyMealRepo.create({
      hostelId,
      mealName: data.mealName.trim(),
      mealNameEn: data.mealNameEn?.trim() || null,
      time: data.time.trim(),
      menuDescription: data.menuDescription?.trim() || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      orderIndex: data.orderIndex !== undefined ? data.orderIndex : 0,
    });
    return this.dailyMealRepo.save(meal);
  }

  public async updateDailyMeal(
    id: string,
    data: Partial<DailyMealInput>,
  ): Promise<HostelDailyMeal | null> {
    const existing = await this.dailyMealRepo.findOne({ where: { id } });
    if (!existing) return null;

    if (data.mealName !== undefined) existing.mealName = data.mealName.trim();
    if (data.mealNameEn !== undefined) existing.mealNameEn = data.mealNameEn?.trim() || null;
    if (data.time !== undefined) existing.time = data.time.trim();
    if (data.menuDescription !== undefined)
      existing.menuDescription = data.menuDescription?.trim() || null;
    if (data.isActive !== undefined) existing.isActive = data.isActive;
    if (data.orderIndex !== undefined) existing.orderIndex = data.orderIndex;

    return this.dailyMealRepo.save(existing);
  }

  public async deleteDailyMeal(id: string): Promise<boolean> {
    const result = await this.dailyMealRepo.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  public async saveDailyMeals(
    hostelId: string,
    meals: DailyMealInput[],
  ): Promise<HostelDailyMeal[]> {
    return AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(HostelDailyMeal);
      await repo.delete({ hostelId });

      const entities = meals.map((m, idx) =>
        repo.create({
          hostelId,
          mealName: m.mealName.trim(),
          mealNameEn: m.mealNameEn?.trim() || null,
          time: m.time.trim(),
          menuDescription: m.menuDescription?.trim() || null,
          isActive: m.isActive !== undefined ? m.isActive : true,
          orderIndex: m.orderIndex !== undefined ? m.orderIndex : idx + 1,
        }),
      );

      await repo.save(entities);
      return repo.find({
        where: { hostelId },
        order: { orderIndex: 'ASC', createdAt: 'ASC' },
      });
    });
  }

  public async clearDailyMeals(hostelId: string): Promise<void> {
    await this.dailyMealRepo.delete({ hostelId });
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
