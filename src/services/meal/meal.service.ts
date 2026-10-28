// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.service.ts
// PURPOSE: Business logic, validation, caching, and authorization for hostel meals.
// ──────────────────────────────────────────────────────────────────────────────

import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { HostelMeal } from '../../entities/meal/hostel-meal.entity';
import { DayOfWeek, DAYS_OF_WEEK_ORDER } from '../../enum/meal.enum';
import { IROLES } from '../../enum/roles.enum';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { MealDayInput, MealRepository } from '../../repository/meal/meal.repository';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuidV4 = (v: unknown): v is string =>
  typeof v === 'string' && UUID_V4.test(v.trim());

export interface FormattedMealDay {
  id: string | null;
  dayOfWeek: DayOfWeek;
  breakfastDescription: string | null;
  breakfastTime: string | null;
  breakfastNotes: string | null;
  mainMealDescription: string | null;
  mainMealTime: string | null;
  mainMealNotes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface WeeklyScheduleResponse {
  hostelId: string;
  hasSchedule: boolean;
  lastUpdatedAt: Date | null;
  schedule: FormattedMealDay[];
}

export class MealService {
  constructor(private readonly repo: MealRepository = new MealRepository()) {}

  private key(hostelId: string): string {
    return cacheService.generateKey('hostel:meals', { hostelId, v: 1 });
  }

  private async invalidate(hostelId: string): Promise<void> {
    await cacheService.invalidatePattern('hostel:meals');
    await cacheService.invalidatePattern('public:hostel');
    await cacheService.invalidatePattern('hostels');
    await cacheService.invalidate(this.key(hostelId)).catch(() => undefined);
  }

  private async verifyHostelOwner(
    hostelId: string,
    user: { userId: string; role: string },
  ): Promise<{ error?: { status: number; message: string }; hostel?: Hostel }> {
    const hostelRepo = AppDataSource.getRepository(Hostel);
    const hostel = await hostelRepo.findOne({
      where: { id: hostelId },
      select: { id: true, ownerId: true, isActive: true },
    });

    if (!hostel) {
      return {
        error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' },
      };
    }

    const role = user.role?.toLowerCase();
    if (role === IROLES.ADMIN) {
      return { hostel };
    }

    if (role === IROLES.OWNER) {
      if (hostel.ownerId !== user.userId) {
        return {
          error: {
            status: STATUS_CODE.FORBIDDEN,
            message: 'You do not own or have permission to manage this hostel',
          },
        };
      }
      return { hostel };
    }

    return {
      error: {
        status: STATUS_CODE.FORBIDDEN,
        message: 'Access denied: only hostel owners or administrators can manage meals',
      },
    };
  }

  private formatSchedule(hostelId: string, rawMeals: HostelMeal[]): WeeklyScheduleResponse {
    const mealMap = new Map<DayOfWeek, HostelMeal>();
    let maxUpdated: Date | null = null;
    let hasAnyConfigured = false;

    for (const m of rawMeals) {
      mealMap.set(m.dayOfWeek, m);
      if (m.updatedAt) {
        if (!maxUpdated || new Date(m.updatedAt) > new Date(maxUpdated)) {
          maxUpdated = m.updatedAt;
        }
      }
      if (
        (m.breakfastDescription && m.breakfastDescription.trim().length > 0) ||
        (m.mainMealDescription && m.mainMealDescription.trim().length > 0)
      ) {
        hasAnyConfigured = true;
      }
    }

    const schedule: FormattedMealDay[] = DAYS_OF_WEEK_ORDER.map((day) => {
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

  public async getWeeklySchedule(
    hostelId: string,
    user?: { userId: string; role: string },
  ): Promise<{ data?: WeeklyScheduleResponse; error?: { status: number; message: string } }> {
    if (!isUuidV4(hostelId)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
      };
    }

    const hostelRepo = AppDataSource.getRepository(Hostel);
    const hostel = await hostelRepo.findOne({
      where: { id: hostelId },
      select: { id: true, ownerId: true, isActive: true },
    });

    if (!hostel) {
      return {
        error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' },
      };
    }

    // If authenticated owner/admin, allow access regardless of isActive
    if (user) {
      const authCheck = await this.verifyHostelOwner(hostelId, user);
      if (authCheck.error) {
        return { error: authCheck.error };
      }
    } else {
      // Public access requires active hostel
      if (!hostel.isActive) {
        return {
          error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel is inactive or not found' },
        };
      }
    }

    const cacheKey = this.key(hostelId);
    const { data } = await cacheService.wrap(
      cacheKey,
      async () => {
        const rawMeals = await this.repo.findByHostelId(hostelId);
        return this.formatSchedule(hostelId, rawMeals);
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    return { data };
  }

  public async saveWeeklySchedule(
    hostelId: string,
    user: { userId: string; role: string },
    meals: MealDayInput[],
  ): Promise<{ data?: WeeklyScheduleResponse; error?: { status: number; message: string } }> {
    if (!isUuidV4(hostelId)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
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

  public async clearWeeklySchedule(
    hostelId: string,
    user: { userId: string; role: string },
  ): Promise<{ data?: WeeklyScheduleResponse; error?: { status: number; message: string } }> {
    if (!isUuidV4(hostelId)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
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

