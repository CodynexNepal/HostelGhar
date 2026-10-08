import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Fake DataSource ─────────────────────────────────────────────────────────
// getAdminDashboard builds its repositories from AppDataSource, so we swap the
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
import { User } from '../../src/entities/user.entity';
import { Subscription } from '../../src/entities/subscription/subscription.entity';
import { AnalyticsRepository } from '../../src/repository/analytics/analytics.repository';
import { AnalyticsService } from '../../src/services/analytics/analytics.services';

/** QueryBuilder stub that answers with a fixed raw row and swallows chaining. */
const rawOne = (row: unknown) => {
  const qb: Record<string, unknown> = {};
  for (const method of ['select', 'addSelect', 'where', 'andWhere', 'orderBy']) {
    qb[method] = () => qb;
  }
  qb.getRawOne = async () => row;
  return qb;
};

/**
 * Fee stub: the all-time aggregate has no WHERE, the monthly one filters on
 * billingMonth/billingYear — route by whether `.where` was called.
 */
const feeRepoStub = (allTime: unknown, month: unknown) => ({
  count: async () => 2,
  createQueryBuilder: () => {
    const qb: Record<string, unknown> = {};
    let filtered = false;
    for (const method of ['select', 'addSelect', 'orderBy']) qb[method] = () => qb;
    qb.where = () => {
      filtered = true;
      return qb;
    };
    qb.andWhere = () => qb;
    qb.getRawOne = async () => (filtered ? month : allTime);
    return qb;
  },
});

const seed = (options: {
  activePlans?: Array<Record<string, unknown>>;
  beds?: { total: string; occupied: string } | null;
  rooms?: { rooms: string; capacity: string; occupied: string } | null;
  hostels?: Array<Record<string, unknown>>;
  pendingRequests?: number;
}) => {
  repositoryMap.set(User, { count: async () => 5 });
  repositoryMap.set(Hostel, {
    count: async () => 4,
    find: async () => options.hostels ?? [],
  });
  repositoryMap.set(Resident, { count: async () => 37 });
  repositoryMap.set(Booking, { count: async () => 1 });
  repositoryMap.set(LeaveRequest, { count: async () => 0 });
  repositoryMap.set(Fee, {
    ...feeRepoStub({ paid: '50000', outstanding: '2500' }, { paid: '12000', billed: '15000' }),
    count: async () => 2,
  });
  repositoryMap.set(Room, {
    createQueryBuilder: () =>
      rawOne(options.rooms ?? { rooms: '9', capacity: '30', occupied: '12' }),
  });
  repositoryMap.set(Bed, {
    createQueryBuilder: () => rawOne(options.beds ?? { total: '0', occupied: '0' }),
  });
  repositoryMap.set(Subscription, {
    count: async () => options.pendingRequests ?? 0,
    find: async () => options.activePlans ?? [],
  });
};

describe('AnalyticsRepository.getAdminDashboard', () => {
  beforeEach(() => {
    repositoryMap.clear();
  });

  it('returns every dashboard block with live DB aggregates', async () => {
    seed({
      activePlans: [
        { id: 's1', price: '1999', billingCycle: 'MONTHLY', endDate: null },
        { id: 's2', price: '1200', billingCycle: 'MONTHLY', endDate: null },
      ],
      beds: { total: '10', occupied: '4' },
      hostels: [
        {
          id: 'h1',
          name: 'IBInfinity Boys Hostel',
          type: 'BOYS',
          city: 'Kathmandu',
          logoUrl: null,
          createdAt: new Date('2026-05-01'),
          owner: null,
        },
        {
          id: 'h2',
          name: 'Sunrise Hostel',
          type: 'GIRLS',
          city: 'Pokhara',
          logoUrl: 'https://cdn/logo.png',
          createdAt: new Date('2026-05-02'),
          owner: {
            id: 'u1',
            firstName: 'Ram',
            lastName: 'Sharma',
            email: 'ram@x.com',
            avatarUrl: null,
          },
        },
      ],
      pendingRequests: 3,
    });

    const dashboard = await new AnalyticsRepository().getAdminDashboard();

    // Legacy clients keep their original fields.
    expect(dashboard.users).toBe(5);
    expect(dashboard.hostels).toBe(4);
    expect(dashboard.activeResidents).toBe(37);
    expect(dashboard.paidAmount).toBe(50000);
    expect(dashboard.outstandingAmount).toBe(2500);

    // Top stat cards.
    expect(dashboard.stats.totalHostels).toBe(4);
    expect(dashboard.stats.totalResidents).toBe(37);
    expect(dashboard.stats.mrr).toBe(3199);
    expect(dashboard.stats.occupancy).toEqual({
      totalBeds: 10,
      occupiedBeds: 4,
      availableBeds: 6,
      rate: 40,
    });

    // MRR diagnostics — a zero card must carry the reason it is zero.
    expect(dashboard.stats.mrrBasis).toBe('activeSubscriptions');
    expect(dashboard.stats.mrrCurrency).toBe('NPR');
    expect(dashboard.stats.mrrPaidPlans).toBe(2);
    expect(dashboard.stats.mrrFreePlans).toBe(0);
    expect(dashboard.stats.mrrLapsedPlans).toBe(0);

    // Pending approvals card.
    expect(dashboard.pendingApprovals).toEqual({
      count: 3,
      reviewUrl: '/admin/subscriptions',
    });

    // Hostels spotlight — an unassigned owner surfaces as null, not a crash.
    expect(dashboard.recentHostels).toHaveLength(2);
    expect(dashboard.recentHostels[0]).toMatchObject({
      name: 'IBInfinity Boys Hostel',
      owner: null,
    });
    expect(dashboard.recentHostels[1].owner).toEqual({
      id: 'u1',
      name: 'Ram Sharma',
      email: 'ram@x.com',
      avatarUrl: null,
    });

    // Platform health card.
    expect(dashboard.health).toEqual({
      monthlyRevenue: 12000,
      totalRevenue: 50000,
      pendingDues: 2500,
      rooms: 9,
      bedsOccupied: 4,
      activePlans: 2,
      currency: 'NPR',
      collectionRate: 80,
    });
  });

  it('amortizes yearly plans over 12 months when computing MRR', async () => {
    seed({ activePlans: [{ id: 's1', price: '12000', billingCycle: 'YEARLY', endDate: null }] });

    const dashboard = await new AnalyticsRepository().getAdminDashboard();

    expect(dashboard.stats.mrr).toBe(1000);
  });

  it('reports MRR 0 with a free-plan reason when no owner is on a paid plan', async () => {
    seed({
      activePlans: [{ id: 'free', price: '0', billingCycle: 'MONTHLY', endDate: null }],
      pendingRequests: 2,
    });

    const dashboard = await new AnalyticsRepository().getAdminDashboard();

    expect(dashboard.stats.mrr).toBe(0);
    expect(dashboard.stats.mrrPaidPlans).toBe(0);
    expect(dashboard.stats.mrrFreePlans).toBe(1);
    // The unpaid upgrade requests are what turns this card from 0 into revenue.
    expect(dashboard.pendingApprovals.count).toBe(2);
  });

  it('ignores ACTIVE subscriptions whose endDate has already lapsed', async () => {
    seed({
      activePlans: [
        { id: 'live', price: '999', billingCycle: 'MONTHLY', endDate: null },
        {
          id: 'expired',
          price: '4999',
          billingCycle: 'MONTHLY',
          endDate: new Date('2000-01-01'),
        },
      ],
    });

    const dashboard = await new AnalyticsRepository().getAdminDashboard();

    expect(dashboard.stats.mrr).toBe(999);
    expect(dashboard.health.activePlans).toBe(1);
  });

  it('falls back to room capacity when no bed inventory exists yet', async () => {
    seed({
      beds: { total: '0', occupied: '0' },
      rooms: { rooms: '5', capacity: '20', occupied: '15' },
    });

    const dashboard = await new AnalyticsRepository().getAdminDashboard();

    expect(dashboard.stats.occupancy).toEqual({
      totalBeds: 20,
      occupiedBeds: 15,
      availableBeds: 5,
      rate: 75,
    });
    expect(dashboard.health.bedsOccupied).toBe(15);
  });

  it('never reports negative availability when room occupancy exceeds capacity', async () => {
    seed({
      beds: { total: '0', occupied: '0' },
      rooms: { rooms: '2', capacity: '6', occupied: '9' },
    });

    const dashboard = await new AnalyticsRepository().getAdminDashboard();

    expect(dashboard.stats.occupancy.occupiedBeds).toBe(6);
    expect(dashboard.stats.occupancy.availableBeds).toBe(0);
  });

  it('returns zeroed cards (never NaN/null) on an empty platform', async () => {
    seed({
      activePlans: [],
      beds: { total: '0', occupied: '0' },
      rooms: { rooms: '0', capacity: '0', occupied: '0' },
      hostels: [],
      pendingRequests: 0,
    });
    repositoryMap.set(
      Fee,
      feeRepoStub({ paid: '0', outstanding: '0' }, { paid: '0', billed: '0' }),
    );

    const dashboard = await new AnalyticsRepository().getAdminDashboard();

    expect(dashboard.stats.mrr).toBe(0);
    expect(dashboard.stats.occupancy).toEqual({
      totalBeds: 0,
      occupiedBeds: 0,
      availableBeds: 0,
      rate: 0,
    });
    expect(dashboard.pendingApprovals.count).toBe(0);
    expect(dashboard.recentHostels).toEqual([]);
    expect(dashboard.health.collectionRate).toBe(0);
  });
});

describe('AnalyticsService admin endpoints share one payload', () => {
  beforeEach(() => {
    repositoryMap.clear();
  });

  it('serves MRR through the legacy getAdminSummary alias too', async () => {
    seed({
      activePlans: [{ id: 's1', price: '1999', billingCycle: 'MONTHLY', endDate: null }],
      beds: { total: '4', occupied: '1' },
    });

    const service = new AnalyticsService(new AnalyticsRepository());

    const dashboard = await service.getAdminDashboard();
    const summary = await service.getAdminSummary();

    // A client pointed at /admin/dashboard/summary or /analytics/admin/summary
    // must not silently lose the MRR card.
    expect(summary.data.stats.mrr).toBe(1999);
    expect(summary.data.stats.mrrPaidPlans).toBe(1);
    // Legacy count fields survive alongside the new blocks.
    expect(summary.data.hostels).toBe(4);
    expect(summary.data.activeResidents).toBe(37);
    expect(dashboard.data.stats.mrr).toBe(1999);
  });
});
