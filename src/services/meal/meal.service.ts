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

export interface DailyMealSlot {
  id?: string | null;
  dayOfWeek?: string;
  mealName: string;
  mealNameEn: string | null;
  time: string;
  menuDescription: string | null;
  isActive: boolean;
  orderIndex: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface DailyScheduleResponse {
  hostelId: string;
  dayOfWeek?: string;
  hasSchedule: boolean;
  isConfigured: boolean;
  lastUpdatedAt: Date | null;
  schedule: DailyMealSlot[];
  configuredDays?: string[];
}

export const DEFAULT_DAILY_MEAL_SLOTS: DailyMealSlot[] = [
  {
    mealName: 'बिहानको नास्ता',
    mealNameEn: 'Morning Breakfast',
    time: '7:00 AM–8:00 AM',
    menuDescription: '',
    isActive: true,
    orderIndex: 1,
  },
  {
    mealName: 'बिहानको खाजा',
    mealNameEn: 'Morning Khaja',
    time: '10:00 AM–11:00 AM',
    menuDescription: '',
    isActive: true,
    orderIndex: 2,
  },
  {
    mealName: 'दिउँसोको खाना',
    mealNameEn: 'Lunch / Khana',
    time: '12:00 PM–1:00 PM',
    menuDescription: '',
    isActive: true,
    orderIndex: 3,
  },
  {
    mealName: 'दिउँसोको खाजा',
    mealNameEn: 'Afternoon Khaja',
    time: '2:00 PM–3:00 PM',
    menuDescription: '',
    isActive: true,
    orderIndex: 4,
  },
  {
    mealName: 'बेलुकाको खाना',
    mealNameEn: 'Dinner / Khana',
    time: '7:00 PM–8:00 PM',
    menuDescription: '',
    isActive: true,
    orderIndex: 5,
  },
];

export interface WeeklyScheduleResponse {
  hostelId: string;
  hasSchedule: boolean;
  lastUpdatedAt: Date | null;
  schedule: FormattedMealDay[];
  dailySchedule?: DailyScheduleResponse;
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

  // ─── DAILY MEAL SCHEDULE (दैनिक भोजन तालिका) ─────────────────────────────

  public async getDailySchedule(
    hostelId: string,
    user?: { userId: string; role: string },
    dayOfWeek?: string,
  ): Promise<{ data?: DailyScheduleResponse; error?: { status: number; message: string } }> {
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

    if (user) {
      const authCheck = await this.verifyHostelOwner(hostelId, user);
      if (authCheck.error) {
        // Residents can view their own hostel's daily meals
        const role = user.role?.toLowerCase();
        if (role !== IROLES.RESIDENT) {
          return { error: authCheck.error };
        }
      }
    } else {
      if (!hostel.isActive) {
        return {
          error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel is inactive or not found' },
        };
      }
    }

    const allRawMeals = await this.repo.findAllDailyMealsRaw(hostelId);
    const configuredDays = Array.from(new Set(allRawMeals.map((m) => m.dayOfWeek || 'ALL')));

    const normDay = dayOfWeek ? dayOfWeek.toUpperCase().trim() : 'ALL';
    const rawDailyMeals = await this.repo.findDailyMealsByHostelId(hostelId, normDay);
    if (rawDailyMeals.length === 0) {
      return {
        data: {
          hostelId,
          dayOfWeek: normDay,
          hasSchedule: false,
          isConfigured: configuredDays.length > 0,
          lastUpdatedAt: null,
          schedule: DEFAULT_DAILY_MEAL_SLOTS.map((s) => ({ ...s, dayOfWeek: normDay })),
          configuredDays,
        },
      };
    }

    let maxUpdated: Date | null = null;
    const schedule: DailyMealSlot[] = rawDailyMeals.map((m) => {
      if (m.updatedAt && (!maxUpdated || new Date(m.updatedAt) > new Date(maxUpdated))) {
        maxUpdated = m.updatedAt;
      }
      return {
        id: m.id,
        dayOfWeek: m.dayOfWeek,
        mealName: m.mealName,
        mealNameEn: m.mealNameEn,
        time: m.time,
        menuDescription: m.menuDescription,
        isActive: m.isActive,
        orderIndex: m.orderIndex,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    });

    return {
      data: {
        hostelId,
        dayOfWeek: normDay,
        hasSchedule: true,
        isConfigured: true,
        lastUpdatedAt: maxUpdated,
        schedule,
        configuredDays,
      },
    };
  }

  public async createDailyMeal(
    hostelId: string,
    user: { userId: string; role: string },
    dto: {
      dayOfWeek?: string;
      mealName: string;
      mealNameEn?: string | null;
      time: string;
      menuDescription?: string | null;
      isActive?: boolean;
      orderIndex?: number;
    },
  ): Promise<{ data?: DailyMealSlot; error?: { status: number; message: string } }> {
    if (!isUuidV4(hostelId)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
      };
    }

    const authCheck = await this.verifyHostelOwner(hostelId, user);
    if (authCheck.error) {
      return { error: authCheck.error };
    }

    const created = await this.repo.createDailyMeal(hostelId, dto);
    await this.invalidate(hostelId);

    return {
      data: {
        id: created.id,
        dayOfWeek: created.dayOfWeek,
        mealName: created.mealName,
        mealNameEn: created.mealNameEn,
        time: created.time,
        menuDescription: created.menuDescription,
        isActive: created.isActive,
        orderIndex: created.orderIndex,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    };
  }

  public async updateDailyMeal(
    hostelId: string,
    mealId: string,
    user: { userId: string; role: string },
    dto: {
      dayOfWeek?: string;
      mealName?: string;
      mealNameEn?: string | null;
      time?: string;
      menuDescription?: string | null;
      isActive?: boolean;
      orderIndex?: number;
    },
  ): Promise<{ data?: DailyMealSlot; error?: { status: number; message: string } }> {
    if (!isUuidV4(hostelId)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
      };
    }

    const authCheck = await this.verifyHostelOwner(hostelId, user);
    if (authCheck.error) {
      return { error: authCheck.error };
    }

    const existing = await this.repo.findDailyMealById(mealId);
    if (!existing || existing.hostelId !== hostelId) {
      return {
        error: { status: STATUS_CODE.NOT_FOUND, message: 'Daily meal not found for this hostel' },
      };
    }

    const updated = await this.repo.updateDailyMeal(mealId, dto);
    if (!updated) {
      return {
        error: { status: STATUS_CODE.NOT_FOUND, message: 'Failed to update daily meal' },
      };
    }
    await this.invalidate(hostelId);

    return {
      data: {
        id: updated.id,
        dayOfWeek: updated.dayOfWeek,
        mealName: updated.mealName,
        mealNameEn: updated.mealNameEn,
        time: updated.time,
        menuDescription: updated.menuDescription,
        isActive: updated.isActive,
        orderIndex: updated.orderIndex,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    };
  }

  public async deleteDailyMeal(
    hostelId: string,
    mealId: string,
    user: { userId: string; role: string },
  ): Promise<{ success?: boolean; error?: { status: number; message: string } }> {
    if (!isUuidV4(hostelId)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
      };
    }

    const authCheck = await this.verifyHostelOwner(hostelId, user);
    if (authCheck.error) {
      return { error: authCheck.error };
    }

    const existing = await this.repo.findDailyMealById(mealId);
    if (!existing || existing.hostelId !== hostelId) {
      return {
        error: { status: STATUS_CODE.NOT_FOUND, message: 'Daily meal not found for this hostel' },
      };
    }

    await this.repo.deleteDailyMeal(mealId);
    await this.invalidate(hostelId);

    return { success: true };
  }

  public async saveDailySchedule(
    hostelId: string,
    user: { userId: string; role: string },
    meals: Array<{
      id?: string;
      dayOfWeek?: string;
      mealName: string;
      mealNameEn?: string | null;
      time: string;
      menuDescription?: string | null;
      isActive?: boolean;
      orderIndex?: number;
    }>,
    dayOfWeek: string = 'ALL',
  ): Promise<{ data?: DailyScheduleResponse; error?: { status: number; message: string } }> {
    if (!isUuidV4(hostelId)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
      };
    }

    const authCheck = await this.verifyHostelOwner(hostelId, user);
    if (authCheck.error) {
      return { error: authCheck.error };
    }

    const normDay = (dayOfWeek || 'ALL').toUpperCase().trim();
    const saved = await this.repo.saveDailyMeals(hostelId, meals, normDay);
    await this.invalidate(hostelId);

    const allRawMeals = await this.repo.findAllDailyMealsRaw(hostelId);
    const configuredDays = Array.from(new Set(allRawMeals.map((m) => m.dayOfWeek || 'ALL')));

    let maxUpdated: Date | null = null;
    const schedule: DailyMealSlot[] = saved.map((m) => {
      if (m.updatedAt && (!maxUpdated || new Date(m.updatedAt) > new Date(maxUpdated))) {
        maxUpdated = m.updatedAt;
      }
      return {
        id: m.id,
        dayOfWeek: m.dayOfWeek,
        mealName: m.mealName,
        mealNameEn: m.mealNameEn,
        time: m.time,
        menuDescription: m.menuDescription,
        isActive: m.isActive,
        orderIndex: m.orderIndex,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    });

    return {
      data: {
        hostelId,
        dayOfWeek: normDay,
        hasSchedule: schedule.length > 0,
        isConfigured: true,
        lastUpdatedAt: maxUpdated,
        schedule,
        configuredDays,
      },
    };
  }

  public async clearDailySchedule(
    hostelId: string,
    user: { userId: string; role: string },
    dayOfWeek?: string,
  ): Promise<{ data?: DailyScheduleResponse; error?: { status: number; message: string } }> {
    if (!isUuidV4(hostelId)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' },
      };
    }

    const authCheck = await this.verifyHostelOwner(hostelId, user);
    if (authCheck.error) {
      return { error: authCheck.error };
    }

    const normDay = dayOfWeek ? dayOfWeek.toUpperCase().trim() : undefined;
    await this.repo.clearDailyMeals(hostelId, normDay);
    await this.invalidate(hostelId);

    const allRawMeals = await this.repo.findAllDailyMealsRaw(hostelId);
    const configuredDays = Array.from(new Set(allRawMeals.map((m) => m.dayOfWeek || 'ALL')));

    return {
      data: {
        hostelId,
        dayOfWeek: normDay || 'ALL',
        hasSchedule: false,
        isConfigured: configuredDays.length > 0,
        lastUpdatedAt: null,
        schedule: DEFAULT_DAILY_MEAL_SLOTS.map((s) => ({ ...s, dayOfWeek: normDay || 'ALL' })),
        configuredDays,
      },
    };
  }
}
