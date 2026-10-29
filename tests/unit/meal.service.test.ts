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
import { HostelDailyMeal } from '../../src/entities/meal/hostel-daily-meal.entity';
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
      return (
        mealStore.find((m) => m.hostelId === where.hostelId && m.dayOfWeek === where.dayOfWeek) ||
        null
      );
    }),
    create: vi.fn().mockImplementation((payload) => ({
      id: 'meal-uuid-' + Math.random(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...payload,
    })),
    save: vi.fn().mockImplementation(async (meal) => {
      const idx = mealStore.findIndex(
        (m) => m.hostelId === meal.hostelId && m.dayOfWeek === meal.dayOfWeek,
      );
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

  let dailyMealStore: HostelDailyMeal[] = [];

  const fakeDailyMealRepo = {
    find: vi.fn().mockImplementation(async (opts) => {
      const where = opts?.where;
      if (where?.hostelId) {
        return dailyMealStore.filter((m) => {
          if (m.hostelId !== where.hostelId) return false;
          if (where.dayOfWeek && (m.dayOfWeek || 'ALL') !== where.dayOfWeek) return false;
          return true;
        });
      }
      return dailyMealStore;
    }),
    findOne: vi.fn().mockImplementation(async ({ where }) => {
      if (where.id) {
        return dailyMealStore.find((m) => m.id === where.id) || null;
      }
      return null;
    }),
    create: vi.fn().mockImplementation((payload) => ({
      id: 'daily-meal-uuid-' + Math.random(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...payload,
    })),
    save: vi.fn().mockImplementation(async (mealOrMeals) => {
      if (Array.isArray(mealOrMeals)) {
        mealOrMeals.forEach((meal) => {
          const idx = dailyMealStore.findIndex((m) => m.id === meal.id);
          if (idx >= 0) {
            dailyMealStore[idx] = { ...meal, updatedAt: new Date() };
          } else {
            dailyMealStore.push(meal);
          }
        });
        return mealOrMeals;
      }
      const idx = dailyMealStore.findIndex((m) => m.id === mealOrMeals.id);
      if (idx >= 0) {
        dailyMealStore[idx] = { ...mealOrMeals, updatedAt: new Date() };
        return dailyMealStore[idx];
      }
      dailyMealStore.push(mealOrMeals);
      return mealOrMeals;
    }),
    delete: vi.fn().mockImplementation(async (criteria) => {
      if (criteria.id) {
        const initial = dailyMealStore.length;
        dailyMealStore = dailyMealStore.filter((m) => m.id !== criteria.id);
        return { affected: initial - dailyMealStore.length };
      }
      if (criteria.hostelId) {
        const initial = dailyMealStore.length;
        dailyMealStore = dailyMealStore.filter((m) => {
          if (m.hostelId !== criteria.hostelId) return true;
          if (criteria.dayOfWeek && (m.dayOfWeek || 'ALL') !== criteria.dayOfWeek) return true;
          return false;
        });
        return { affected: initial - dailyMealStore.length };
      }
      return { affected: 0 };
    }),
  };

  beforeEach(() => {
    mealStore = [];
    dailyMealStore = [];
    repositoryMap.clear();
    repositoryMap.set(Hostel, fakeHostelRepo);
    repositoryMap.set(HostelMeal, fakeMealRepo);
    repositoryMap.set(HostelDailyMeal, fakeDailyMealRepo);
  });

  it('allows owner to save a complete weekly meal schedule', async () => {
    const service = new MealService(new MealRepository());

    const result = await service.saveWeeklySchedule(hostelId, { userId: ownerId, role: 'OWNER' }, [
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
    ]);

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
    await service.saveWeeklySchedule(hostelId, { userId: ownerId, role: 'OWNER' }, [
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
    ]);

    // 2. Update ONLY Sunday
    const updated = await service.saveWeeklySchedule(hostelId, { userId: ownerId, role: 'OWNER' }, [
      {
        dayOfWeek: DayOfWeek.SUNDAY,
        breakfastDescription: 'Oatmeal & Milk',
        mainMealDescription: 'Dal Bhat & Paneer',
      },
    ]);

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

    await service.saveWeeklySchedule(hostelId, { userId: ownerId, role: 'OWNER' }, [
      {
        dayOfWeek: DayOfWeek.SUNDAY,
        breakfastDescription: 'Tea',
        mainMealDescription: 'Dal Bhat',
      },
    ]);

    const cleared = await service.clearWeeklySchedule(hostelId, { userId: ownerId, role: 'OWNER' });
    expect(cleared.error).toBeUndefined();
    expect(cleared.data?.hasSchedule).toBe(false);

    const sunday = cleared.data?.schedule.find((s) => s.dayOfWeek === DayOfWeek.SUNDAY);
    expect(sunday?.breakfastDescription).toBeNull();
  });

  describe('दैनिक भोजन तालिका (Daily Meal Schedule)', () => {
    it('returns the initial 5 configurable default meal slots when not yet saved in DB', async () => {
      const service = new MealService(new MealRepository());
      const res = await service.getDailySchedule(hostelId, { userId: ownerId, role: 'OWNER' });

      expect(res.error).toBeUndefined();
      expect(res.data?.hasSchedule).toBe(false);
      expect(res.data?.isConfigured).toBe(false);
      expect(res.data?.schedule).toHaveLength(5);

      const names = res.data?.schedule.map((s) => s.mealName);
      expect(names).toEqual([
        'बिहानको नास्ता',
        'बिहानको खाजा',
        'दिउँसोको खाना',
        'दिउँसोको खाजा',
        'बेलुकाको खाना',
      ]);

      const times = res.data?.schedule.map((s) => s.time);
      expect(times).toEqual([
        '7:00 AM–8:00 AM',
        '10:00 AM–11:00 AM',
        '12:00 PM–1:00 PM',
        '2:00 PM–3:00 PM',
        '7:00 PM–8:00 PM',
      ]);
    });

    it('allows owner to add a new daily meal slot', async () => {
      const service = new MealService(new MealRepository());
      const res = await service.createDailyMeal(
        hostelId,
        { userId: ownerId, role: 'OWNER' },
        {
          mealName: 'रात्रिकालीन दूध र फलफूल',
          mealNameEn: 'Night Milk & Fruits',
          time: '9:30 PM–10:00 PM',
          menuDescription: 'Warm milk, seasonal fruits',
          isActive: true,
          orderIndex: 6,
        },
      );

      expect(res.error).toBeUndefined();
      expect(res.data?.mealName).toBe('रात्रिकालीन दूध र फलफूल');
      expect(res.data?.mealNameEn).toBe('Night Milk & Fruits');
      expect(res.data?.time).toBe('9:30 PM–10:00 PM');
      expect(res.data?.isActive).toBe(true);
      expect(res.data?.id).toBeDefined();
    });

    it('allows owner to update an existing daily meal slot', async () => {
      const service = new MealService(new MealRepository());
      const created = await service.createDailyMeal(
        hostelId,
        { userId: ownerId, role: 'OWNER' },
        {
          mealName: 'बिहानको नास्ता',
          mealNameEn: 'Morning Breakfast',
          time: '7:00 AM–8:00 AM',
          menuDescription: 'Tea, toast',
          isActive: true,
          orderIndex: 1,
        },
      );

      const updated = await service.updateDailyMeal(
        hostelId,
        created.data!.id!,
        { userId: ownerId, role: 'OWNER' },
        {
          time: '7:15 AM–8:30 AM',
          menuDescription: 'Milk tea, paratha, aloo tarkari',
          isActive: false,
        },
      );

      expect(updated.error).toBeUndefined();
      expect(updated.data?.time).toBe('7:15 AM–8:30 AM');
      expect(updated.data?.menuDescription).toBe('Milk tea, paratha, aloo tarkari');
      expect(updated.data?.isActive).toBe(false);
    });

    it('allows owner to delete a daily meal slot with confirmation', async () => {
      const service = new MealService(new MealRepository());
      const created = await service.createDailyMeal(
        hostelId,
        { userId: ownerId, role: 'OWNER' },
        {
          mealName: 'दिउँसोको खाजा',
          time: '2:00 PM–3:00 PM',
        },
      );

      const del = await service.deleteDailyMeal(hostelId, created.data!.id!, {
        userId: ownerId,
        role: 'OWNER',
      });
      expect(del.error).toBeUndefined();
      expect(del.success).toBe(true);
    });

    it('allows owner to save and replace all daily meal slots in bulk', async () => {
      const service = new MealService(new MealRepository());
      const slots = [
        {
          mealName: 'बिहानको नास्ता',
          mealNameEn: 'Morning Breakfast',
          time: '7:00 AM–8:00 AM',
          menuDescription: 'Eggs & Bread',
          isActive: true,
          orderIndex: 1,
        },
        {
          mealName: 'बिहानको खाजा',
          mealNameEn: 'Morning Khaja',
          time: '10:00 AM–11:00 AM',
          menuDescription: 'Chiura & Chana',
          isActive: true,
          orderIndex: 2,
        },
        {
          mealName: 'दिउँसोको खाना',
          mealNameEn: 'Lunch / Khana',
          time: '12:00 PM–1:00 PM',
          menuDescription: 'Dal Bhat Tarkari',
          isActive: true,
          orderIndex: 3,
        },
        {
          mealName: 'दिउँसोको खाजा',
          mealNameEn: 'Afternoon Khaja',
          time: '2:00 PM–3:00 PM',
          menuDescription: 'Tea & Biscuits',
          isActive: true,
          orderIndex: 4,
        },
        {
          mealName: 'बेलुकाको खाना',
          mealNameEn: 'Dinner / Khana',
          time: '7:00 PM–8:00 PM',
          menuDescription: 'Rice, Chicken Curry, Salad',
          isActive: true,
          orderIndex: 5,
        },
      ];

      const saved = await service.saveDailySchedule(
        hostelId,
        { userId: ownerId, role: 'OWNER' },
        slots,
      );
      expect(saved.error).toBeUndefined();
      expect(saved.data?.hasSchedule).toBe(true);
      expect(saved.data?.schedule).toHaveLength(5);
      expect(saved.data?.schedule[0].menuDescription).toBe('Eggs & Bread');
      expect(saved.data?.schedule[4].menuDescription).toBe('Rice, Chicken Curry, Salad');
    });

    it('enforces authorization and hostel isolation on daily meals', async () => {
      const service = new MealService(new MealRepository());

      // Attempt by another hostel owner
      const res = await service.createDailyMeal(
        hostelId,
        { userId: otherOwnerId, role: 'OWNER' },
        {
          mealName: 'अनधिकृत खाजा',
          time: '1:00 PM',
        },
      );

      expect(res.error).toBeDefined();
      expect(res.error?.status).toBe(STATUS_CODE.FORBIDDEN);
    });

    it('allows resident to view the saved daily meal schedule', async () => {
      const service = new MealService(new MealRepository());
      const res = await service.getDailySchedule(hostelId, {
        userId: 'resident-user-1',
        role: 'RESIDENT',
      });

      expect(res.error).toBeUndefined();
      expect(res.data?.schedule).toBeDefined();
    });

    it('supports configuring and retrieving meal schedules for specific days of the week', async () => {
      const service = new MealService(new MealRepository());

      // Save schedule specifically for SUNDAY
      const sundaySlots = [
        {
          mealName: 'बिहानको नास्ता',
          mealNameEn: 'Breakfast',
          time: '7:30 AM–8:30 AM',
          menuDescription: 'Sunday Special: Halwa Puri & Milk Tea',
          isActive: true,
          orderIndex: 1,
        },
        {
          mealName: 'दिउँसोको खाना',
          mealNameEn: 'Lunch / Khana',
          time: '12:00 PM–1:00 PM',
          menuDescription: 'Sunday Special: Rice, Mutton Curry, Salad',
          isActive: true,
          orderIndex: 2,
        },
      ];

      const saveRes = await service.saveDailySchedule(
        hostelId,
        { userId: ownerId, role: 'OWNER' },
        sundaySlots,
        'SUNDAY',
      );
      expect(saveRes.error).toBeUndefined();
      expect(saveRes.data?.dayOfWeek).toBe('SUNDAY');
      expect(saveRes.data?.schedule).toHaveLength(2);
      expect(saveRes.data?.schedule[0].menuDescription).toContain('Halwa Puri');

      // Retrieve for SUNDAY
      const getSunday = await service.getDailySchedule(
        hostelId,
        { userId: ownerId, role: 'OWNER' },
        'SUNDAY',
      );
      expect(getSunday.data?.schedule).toHaveLength(2);
      expect(getSunday.data?.schedule[1].menuDescription).toContain('Mutton Curry');
      expect(getSunday.data?.configuredDays).toContain('SUNDAY');
    });
  });
});
