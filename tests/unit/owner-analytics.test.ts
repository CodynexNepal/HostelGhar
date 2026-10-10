import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Fake DataSource ─────────────────────────────────────────────────────────
// getOwnerSummary builds its repositories from AppDataSource, so we swap the
// DataSource for an in-memory repository map (no DB / no Redis needed).
const { repositoryMap } = vi.hoisted(() => ({ repositoryMap: new Map<unknown, unknown>() }));

vi.mock('../../src/database/database-source', () => ({
  AppDataSource: {
    getRepository: (entity: unknown) => repositoryMap.get(entity),
    query: vi.fn(),
  },
}));

import { Hostel } from '../../src/entities/hostel/hostel.entity';
import { Resident } from '../../src/entities/resident/resident.entity';
import { Booking } from '../../src/entities/booking/booking.entity';
import { Fee } from '../../src/entities/fee/fee.entity';
import { LeaveRequest } from '../../src/entities/leave/leave-request.entity';
import { Room } from '../../src/entities/room/room.entity';
import { Bed } from '../../src/entities/bed/bed.entity';
import { Subscription } from '../../src/entities/subscription/subscription.entity';
import { AnalyticsRepository } from '../../src/repository/analytics/analytics.repository';

/** QueryBuilder stub: every chained call returns itself, `getCount` answers. */
const stubQueryBuilder = () => {
  const qb: Record<string, unknown> = {};
  for (const method of [
    'leftJoin',
    'select',
    'where',
    'andWhere',
    'groupBy',
    'orderBy',
    'addSelect',
    'addGroupBy',
    'addOrderBy',
  ])
    qb[method] = () => qb;
  qb.getCount = async () => 0;
  return qb;
};

const hostelRow = (id: string, name: string, city: string) => ({
  id,
  name,
  city,
  address: `${city} 1`,
});

const seed = (options: {
  hostels?: Array<Record<string, unknown>>;
  residents?: Array<Record<string, unknown>>;
  rooms?: Array<Record<string, unknown>>;
  beds?: Array<Record<string, unknown>>;
  fees?: Array<Record<string, unknown>>;
  activePlanRows?: Array<Record<string, unknown>>;
}) => {
  repositoryMap.set(Hostel, { find: async () => options.hostels ?? [] });
  repositoryMap.set(Resident, { find: async () => options.residents ?? [] });
  repositoryMap.set(Room, { find: async () => options.rooms ?? [] });
  repositoryMap.set(Bed, { find: async () => options.beds ?? [] });
  repositoryMap.set(Fee, { find: async () => options.fees ?? [] });
  repositoryMap.set(Booking, { count: async () => 0 });
  repositoryMap.set(LeaveRequest, { createQueryBuilder: stubQueryBuilder });
  repositoryMap.set(Subscription, { find: async () => options.activePlanRows ?? [] });
};

describe('AnalyticsRepository.getOwnerSummary', () => {
  beforeEach(() => {
    repositoryMap.clear();
  });

  it('returns the lean owner cards: mrr, planMix, finance.allTime, feeLifecycle, occupancyByHostel, topHostelsByResidents', async () => {
    seed({
      hostels: [hostelRow('h1', 'Infinity Boys Hostel', 'Kathmandu')],
      residents: Array.from({ length: 5 }, (_, i) => ({
        id: `r${i + 1}`,
        hostelId: 'h1',
        isActive: true,
        createdAt: new Date('2026-09-10'),
      })),
      rooms: [{ id: 'r1', hostelId: 'h1', capacity: 2, occupied: 0 }],
      beds: [
        { id: 'b1', hostelId: 'h1', roomId: 'r1', status: 'OCCUPIED' },
        { id: 'b2', hostelId: 'h1', roomId: 'r1', status: 'AVAILABLE' },
      ],
      fees: [
        {
          id: 'f1',
          hostelId: 'h1',
          totalPayable: '52500',
          paidAmount: '42000',
          billingMonth: 9,
          billingYear: 2026,
          status: 'PARTIALLY_PAID',
          createdAt: new Date('2026-09-01'),
        },
      ],
      activePlanRows: [
        { id: 's1', hostelId: 'h1', price: '1998.96', billingCycle: 'YEARLY', endDate: null },
      ],
    });

    const dashboard = await new AnalyticsRepository().getOwnerSummary('owner-1');

    // Headline cards.
    expect(dashboard.hostels).toBe(1);
    expect(dashboard.activeResidents).toBe(5);

    // ── MRR + plan mix ─────────────────────────────────────────────────────
    expect(dashboard.mrr).toEqual({
      amount: 166.58,
      currency: 'NPR',
      basis: 'activeSubscriptions',
      paidPlans: 1,
      freePlans: 0,
      lapsedPlans: 0,
    });
    expect(dashboard.planMix).toEqual({
      hostelsOnPlans: 1,
      paid: 1,
      free: 0,
      lapsed: 0,
      paidPercent: 100,
      freePercent: 0,
      lapsedPercent: 0,
    });

    // ── All-time finance ───────────────────────────────────────────────────
    expect(dashboard.finance.allTime).toEqual({ collected: 42000, outstanding: 10500 });

    // ── Removed legacy / unused fields ────────────────────────────────────
    expect(dashboard).not.toHaveProperty('capacityByRoom');
    expect(dashboard).not.toHaveProperty('roomOccupancy');
    expect(dashboard).not.toHaveProperty('totals');
    expect(dashboard).not.toHaveProperty('outstandingAmount');
    expect(dashboard).not.toHaveProperty('pendingBookings');
    expect(dashboard).not.toHaveProperty('pendingLeaves');
  });

  it('handles lapsed plans and owner-wide FREE plans (mrr stays 0, shares recompute)', async () => {
    seed({
      hostels: [hostelRow('h1', 'Infinity Boys Hostel', 'Kathmandu')],
      fees: [],
      activePlanRows: [
        { id: 's1', hostelId: null, price: '0', billingCycle: 'MONTHLY', endDate: null },
        {
          id: 's2',
          hostelId: 'h1',
          price: '4999',
          billingCycle: 'MONTHLY',
          endDate: new Date('2020-01-01'),
        },
      ],
    });

    const dashboard = await new AnalyticsRepository().getOwnerSummary('owner-1');

    expect(dashboard.mrr).toEqual({
      amount: 0,
      currency: 'NPR',
      basis: 'activeSubscriptions',
      paidPlans: 0,
      freePlans: 1,
      lapsedPlans: 1,
    });
    expect(dashboard.planMix).toEqual({
      hostelsOnPlans: 1,
      paid: 0,
      free: 1,
      lapsed: 1,
      paidPercent: 0,
      freePercent: 50,
      lapsedPercent: 50,
    });
  });

  it('returns zeroed lean blocks when the owner has no hostels', async () => {
    seed({
      hostels: [],
      fees: [],
      activePlanRows: [],
    });

    const dashboard = await new AnalyticsRepository().getOwnerSummary('owner-1');

    expect(dashboard).toMatchObject({
      hostels: 0,
      activeResidents: 0,
      occupancyByHostel: [],
      topHostelsByResidents: [],
      mrr: { amount: 0, basis: 'activeSubscriptions' },
      planMix: { hostelsOnPlans: 0, paid: 0, free: 0, lapsed: 0 },
      finance: { allTime: { collected: 0, outstanding: 0 } },
      feeLifecycle: { total: 0, paid: 0, pending: 0, overdue: 0, partiallyPaid: 0 },
    });
    expect(dashboard).not.toHaveProperty('capacityByRoom');
    expect(dashboard).not.toHaveProperty('roomOccupancy');
    expect(dashboard).not.toHaveProperty('totals');
    expect(dashboard).not.toHaveProperty('outstandingAmount');
  });
});

it('keeps the exact payload size predictable for the analytics client', async () => {
  seed({
    hostels: [
      hostelRow('h1', 'Infinity Boys Hostel', 'Kathmandu'),
      hostelRow('h2', 'Sunrise Hostel', 'Pokhara'),
    ],
    residents: [
      { id: 'r1', hostelId: 'h1', isActive: true, createdAt: new Date('2026-09-10') },
      { id: 'r2', hostelId: 'h2', isActive: true, createdAt: new Date('2026-09-11') },
    ],
    rooms: [
      { id: 'r1', hostelId: 'h1', capacity: 2, occupied: 0 },
      { id: 'r2', hostelId: 'h2', capacity: 3, occupied: 1 },
    ],
    beds: [{ id: 'b1', hostelId: 'h1', roomId: 'r1', status: 'OCCUPIED' }],
    fees: [
      {
        id: 'f1',
        hostelId: 'h1',
        totalPayable: '10500',
        paidAmount: '10500',
        billingMonth: 9,
        billingYear: 2026,
        status: 'PAID',
        createdAt: new Date('2026-09-01'),
      },
      {
        id: 'f2',
        hostelId: 'h2',
        totalPayable: '12000',
        paidAmount: '9000',
        billingMonth: 9,
        billingYear: 2026,
        status: 'PARTIALLY_PAID',
        createdAt: new Date('2026-09-02'),
      },
      {
        id: 'f3',
        hostelId: 'h1',
        totalPayable: '52500',
        paidAmount: '42000',
        billingMonth: 8,
        billingYear: 2026,
        status: 'PENDING',
        createdAt: new Date('2026-08-01'),
      },
    ],
    activePlanRows: [
      { id: 's1', hostelId: 'h1', price: '1998.96', billingCycle: 'YEARLY', endDate: null },
    ],
  });

  const dashboard = await new AnalyticsRepository().getOwnerSummary('owner-1');

  expect(dashboard.hostels).toBe(2);
  expect(dashboard.activeResidents).toBe(2);
  expect(dashboard.finance.allTime.collected).toBe(61500);
  expect(dashboard.finance.allTime.outstanding).toBe(13500);
  expect(dashboard.feeLifecycle.paid).toBe(1);
  expect(dashboard.feeLifecycle.pending).toBe(1);
  expect(dashboard.feeLifecycle.partiallyPaid).toBe(1);
  expect(dashboard.occupancyByHostel).toEqual([
    {
      hostelId: 'h1',
      hostelName: 'Infinity Boys Hostel',
      city: 'Kathmandu',
      totalBeds: 1,
      occupiedBeds: 1,
      availableBeds: 0,
      occupancyRate: 100,
      residents: 1,
    },
    {
      hostelId: 'h2',
      hostelName: 'Sunrise Hostel',
      city: 'Pokhara',
      totalBeds: 3,
      occupiedBeds: 1,
      availableBeds: 2,
      occupancyRate: 33.3,
      residents: 1,
    },
  ]);
  expect(dashboard.topHostelsByResidents).toEqual([
    { hostelId: 'h1', name: 'Infinity Boys Hostel', city: 'Kathmandu', residents: 1 },
    { hostelId: 'h2', name: 'Sunrise Hostel', city: 'Pokhara', residents: 1 },
  ]);
});

it('sorts occupancyByHostel by residents, caps topHostelsByResidents at 5', async () => {
  const hostels = Array.from({ length: 6 }, (_, i) =>
    hostelRow(`h${i + 1}`, `Hostel ${String.fromCharCode(65 + i)}`, 'Kathmandu'),
  );
  const residents = hostels.map((hostel) => ({
    id: `r${hostel.id}`,
    hostelId: hostel.id,
    isActive: hostel.id === 'h1', // h1 has the most residents
    createdAt: new Date('2026-09-10'),
  }));
  seed({
    hostels,
    residents,
    rooms: hostels.map((h) => ({ id: `r${h.id}`, hostelId: h.id, capacity: 1, occupied: 0 })),
    fees: [],
    activePlanRows: [],
  });

  const dashboard = await new AnalyticsRepository().getOwnerSummary('owner-1');

  // h1 has 1 active resident; all others have 0, so h1 sorts first by residents desc.
  expect(dashboard.occupancyByHostel[0]?.hostelName).toBe('Hostel A');
  expect(dashboard.occupancyByHostel[0]?.residents).toBe(1);
  expect(dashboard.topHostelsByResidents).toEqual([
    { hostelId: 'h1', name: 'Hostel A', city: 'Kathmandu', residents: 1 },
    { hostelId: 'h2', name: 'Hostel B', city: 'Kathmandu', residents: 0 },
    { hostelId: 'h3', name: 'Hostel C', city: 'Kathmandu', residents: 0 },
    { hostelId: 'h4', name: 'Hostel D', city: 'Kathmandu', residents: 0 },
    { hostelId: 'h5', name: 'Hostel E', city: 'Kathmandu', residents: 0 },
  ]);
});
