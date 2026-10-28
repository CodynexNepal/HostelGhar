import 'reflect-metadata';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { repositoryMap } = vi.hoisted(() => ({ repositoryMap: new Map<unknown, unknown>() }));

vi.mock('../../src/database/database-source', () => ({
  AppDataSource: {
    getRepository: (entity: unknown) => repositoryMap.get(entity),
    transaction: async (cb: (manager: { getRepository: (e: unknown) => unknown }) => unknown) => {
      return cb({
        getRepository: (e: unknown) => repositoryMap.get(e),
      });
    },
    query: vi.fn(),
  },
}));

vi.mock('../../src/utils/cache.util', () => ({
  cacheService: {
    generateKey: vi.fn((prefix, obj) => `${prefix}:${JSON.stringify(obj)}`),
    wrap: vi.fn(async (_key, fn) => ({ data: await fn() })),
    invalidatePattern: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  },
}));

import { Hostel } from '../../src/entities/hostel/hostel.entity';
import { HostelMeal } from '../../src/entities/meal/hostel-meal.entity';
import { MealService } from '../../src/services/meal/meal.service';
import { MealRepository } from '../../src/repository/meal/meal.repository';
import { DayOfWeek } from '../../src/enum/meal.enum';
import { STATUS_CODE } from '../../src/constant/statusCode.interface';

describe('MealService', () => {
  const hostelId = 'a38bf07a-b7b1-49dc-85c8-dd5542a8e90a';
  const ownerId = 'b11bf07a-b7b1-49dc-85c8-dd5542a8e90b';
  const otherOwnerId = 'c22bf07a-b7b1-49dc-85c8-dd5542a8e90c';

  const mockHostel = {
    id: hostelId,
    name: 'Everest Boys Hostel',
    ownerId: ownerId,
    isActive: true,
  };

  let mealStore: HostelMeal[] = [];

  const fakeHostelRepo = {
    findOne: vi.fn().mockImplementation(async ({ where }) => {
      if (where.id === hostelId) return mockHostel;
      return null;
    }),
  };

  const fakeMealRepo = {
    find: vi.fn().mockImplementation(async () => mealStore),
    findOne: vi.fn().mockImplementation(async ({ where }) => {
      return mealStore.find((m) => m.hostelId === where.hostelId && m.dayOfWeek === where.dayOfWeek) || null;
    }),
    create: vi.fn().mockImplementation((payload) => ({
      id: 'meal-uuid-' + Math.random(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...payload,
    })),
    save: vi.fn().mockImplementation(async (meal) => {
      const idx = mealStore.findIndex((m) => m.hostelId === meal.hostelId && m.dayOfWeek === meal.dayOfWeek);
      if (idx >= 0) {
        mealStore[idx] = { ...meal, updatedAt: new Date() };
        return mealStore[idx];
      }
      mealStore.push(meal);
      return meal;
    }),
    delete: vi.fn().mockImplementation(async ({ hostelId: hid }) => {
      mealStore = mealStore.filter((m) => m.hostelId !== hid);
    }),
  };

  beforeEach(() => {
    mealStore = [];
    repositoryMap.clear();
    repositoryMap.set(Hostel, fakeHostelRepo);
    repositoryMap.set(HostelMeal, fakeMealRepo);
  });

  it('allows owner to save a complete weekly meal schedule', async () => {
    const service = new MealService(new MealRepository());

    const result = await service.saveWeeklySchedule(
      hostelId,
      { userId: ownerId, role: 'OWNER' },
      [
        {
          dayOfWeek: DayOfWeek.SUNDAY,
          breakfastDescription: 'Tea, boiled eggs, bread',
          breakfastTime: '7:30 AM',
          breakfastNotes: 'Vegetarian option: banana',
          mainMealDescription: 'Dal bhat, seasonal vegetables, chicken curry',
          mainMealTime: '7:00 PM',
          mainMealNotes: 'Special Sunday non-veg dinner',
        },
        {
          dayOfWeek: DayOfWeek.MONDAY,
          breakfastDescription: 'Milk tea, chiura, yogurt',
          breakfastTime: '7:30 AM',
          mainMealDescription: 'Rice, dal, mixed vegetables',
          mainMealTime: '7:00 PM',
        },
      ],
    );

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data?.hasSchedule).toBe(true);

    const sunday = result.data?.schedule.find((s) => s.dayOfWeek === DayOfWeek.SUNDAY);
    expect(sunday?.breakfastDescription).toBe('Tea, boiled eggs, bread');
    expect(sunday?.mainMealDescription).toBe('Dal bhat, seasonal vegetables, chicken curry');

    const monday = result.data?.schedule.find((s) => s.dayOfWeek === DayOfWeek.MONDAY);
    expect(monday?.breakfastDescription).toBe('Milk tea, chiura, yogurt');

    // Unconfigured days should have empty/null descriptions, not invented fake menus
    const tuesday = result.data?.schedule.find((s) => s.dayOfWeek === DayOfWeek.TUESDAY);
    expect(tuesday?.breakfastDescription).toBeNull();
    expect(tuesday?.mainMealDescription).toBeNull();
  });

  it('preserves existing days when editing only one day', async () => {
    const service = new MealService(new MealRepository());

    // 1. Save Sunday and Monday
    await service.saveWeeklySchedule(
      hostelId,
      { userId: ownerId, role: 'OWNER' },
      [
        {
          dayOfWeek: DayOfWeek.SUNDAY,
          breakfastDescription: 'Tea & Toast',
          mainMealDescription: 'Dal Bhat',
        },
        {
          dayOfWeek: DayOfWeek.MONDAY,
          breakfastDescription: 'Puri Tarkari',
          mainMealDescription: 'Rice & Curry',
        },
      ],
    );

    // 2. Update ONLY Sunday
    const updated = await service.saveWeeklySchedule(
      hostelId,
      { userId: ownerId, role: 'OWNER' },
      [
        {
          dayOfWeek: DayOfWeek.SUNDAY,
          breakfastDescription: 'Oatmeal & Milk',
          mainMealDescription: 'Dal Bhat & Paneer',
        },
      ],
    );

    expect(updated.error).toBeUndefined();
    const sunday = updated.data?.schedule.find((s) => s.dayOfWeek === DayOfWeek.SUNDAY);
    expect(sunday?.breakfastDescription).toBe('Oatmeal & Milk');

    // Monday must still be preserved!
    const monday = updated.data?.schedule.find((s) => s.dayOfWeek === DayOfWeek.MONDAY);
    expect(monday?.breakfastDescription).toBe('Puri Tarkari');
  });

  it('forbids an owner from modifying another owner hostel meals', async () => {
    const service = new MealService(new MealRepository());

    const result = await service.saveWeeklySchedule(
      hostelId,
      { userId: otherOwnerId, role: 'OWNER' },
      [
        {
          dayOfWeek: DayOfWeek.SUNDAY,
          breakfastDescription: 'Hack attempt',
        },
      ],
    );

    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(STATUS_CODE.FORBIDDEN);
  });

  it('allows an ADMIN to manage any hostel meals', async () => {
    const service = new MealService(new MealRepository());

    const result = await service.saveWeeklySchedule(
      hostelId,
      { userId: 'admin-id', role: 'ADMIN' },
      [
        {
          dayOfWeek: DayOfWeek.WEDNESDAY,
          breakfastDescription: 'Pancake & tea',
          mainMealDescription: 'Dal bhat tarkari',
        },
      ],
    );

    expect(result.error).toBeUndefined();
    expect(result.data?.hasSchedule).toBe(true);
  });

  it('returns all 7 days in order from SUNDAY to SATURDAY', async () => {
    const service = new MealService(new MealRepository());

    const result = await service.getWeeklySchedule(hostelId);
    expect(result.error).toBeUndefined();
    expect(result.data?.schedule).toHaveLength(7);
    expect(result.data?.schedule[0].dayOfWeek).toBe(DayOfWeek.SUNDAY);
    expect(result.data?.schedule[6].dayOfWeek).toBe(DayOfWeek.SATURDAY);
  });

  it('allows clearing the weekly schedule with proper confirmation', async () => {
    const service = new MealService(new MealRepository());

    await service.saveWeeklySchedule(
      hostelId,
      { userId: ownerId, role: 'OWNER' },
      [
        {
          dayOfWeek: DayOfWeek.SUNDAY,
          breakfastDescription: 'Tea',
          mainMealDescription: 'Dal Bhat',
        },
      ],
    );

    const cleared = await service.clearWeeklySchedule(hostelId, { userId: ownerId, role: 'OWNER' });
    expect(cleared.error).toBeUndefined();
    expect(cleared.data?.hasSchedule).toBe(false);

    const sunday = cleared.data?.schedule.find((s) => s.dayOfWeek === DayOfWeek.SUNDAY);
    expect(sunday?.breakfastDescription).toBeNull();
  });
});

