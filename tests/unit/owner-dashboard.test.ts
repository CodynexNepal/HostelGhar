import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Fake DataSource ─────────────────────────────────────────────────────────
// The dashboard service builds its repositories from AppDataSource, so we swap
// the DataSource for an in-memory repository map (no DB / no Redis needed).
const { repositoryMap } = vi.hoisted(() => ({ repositoryMap: new Map<unknown, unknown>() }));

vi.mock('../../src/database/database-source', () => ({
  AppDataSource: {
    getRepository: (entity: unknown) => repositoryMap.get(entity),
    query: vi.fn(),
  },
}));

import { Hostel } from '../../src/entities/hostel/hostel.entity';
import { LeaveRequest } from '../../src/entities/leave/leave-request.entity';
import { Resident } from '../../src/entities/resident/resident.entity';
import { Room } from '../../src/entities/room/room.entity';
import { Fee } from '../../src/entities/fee/fee.entity';
import { OptimizedHostelQueryService } from '../../src/services/hostel/hostel-query.service';

/** Minimal QueryBuilder stub: every chained call returns itself. */
const stubQueryBuilder = (rawManyRows: unknown[], rawOneRow?: unknown) => {
  const qb: Record<string, unknown> = {};
  for (const method of [
    'leftJoin',
    'select',
    'where',
    'groupBy',
    'orderBy',
    'andWhere',
    'addSelect',
    'addGroupBy',
    'addOrderBy',
    'limit',
  ]) {
    qb[method] = () => qb;
  }
  qb.getRawMany = async () => rawManyRows;
  qb.getRawOne = async () => rawOneRow ?? {};
  return qb;
};

interface FeeQbFixtures {
  monthly: { collected: string };
  pending: { outstanding: string; cnt: string };
  trend: Array<{
    billingYear: string;
    billingMonth: string;
    collected: string;
    outstanding: string;
  }>;
}

/** Fee QueryBuilder stub that answers based on the columns it was asked for. */
const feeQueryBuilderFactory = (fixtures: FeeQbFixtures) => () => {
  const fields: string[] = [];
  const qb: Record<string, unknown> = {};
  qb.select = (sel: string) => {
    fields.push(sel);
    return qb;
  };
  qb.addSelect = (sel: string) => {
    fields.push(sel);
    return qb;
  };
  for (const method of [
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'addOrderBy',
    'limit',
  ]) {
    qb[method] = () => qb;
  }
  qb.getRawOne = async () =>
    fields.some((field) => field.includes('COUNT(fee.id)')) ? fixtures.pending : fixtures.monthly;
  qb.getRawMany = async () => fixtures.trend;
  return qb;
};

const HOSTEL_ROWS = [
  {
    hostelId: 'h1',
    hostelName: 'Sunrise Hostel',
    hostelType: 'BOYS',
    totalActiveResidents: '5',
    residentsOnLeaveToday: '1',
  },
  {
    hostelId: 'h2',
    hostelName: 'Lakeside Hostel',
    hostelType: 'GIRLS',
    totalActiveResidents: '0',
    residentsOnLeaveToday: '0',
  },
];

const ROOMS = [
  {
    id: 'r1',
    hostelId: 'h1',
    roomNumber: '101',
    type: 'TRIPLE',
    capacity: 3,
    occupied: 0,
    floor: 1,
    status: 'AVAILABLE',
  },
  {
    id: 'r2',
    hostelId: 'h1',
    roomNumber: '201',
    type: 'TRIPLE',
    capacity: 3,
    occupied: 1,
    floor: 2,
    status: 'AVAILABLE',
  },
  {
    id: 'r3',
    hostelId: 'h2',
    roomNumber: '401',
    type: 'DOUBLE',
    capacity: 2,
    occupied: 2,
    floor: 4,
    status: 'OCCUPIED',
  },
];

const RECENT_FEE = {
  id: 'f1',
  residentId: 'res1',
  hostelId: 'h1',
  paidAmount: '10500.00',
  totalPayable: '10500.00',
  status: 'PAID',
  billingMonth: 9,
  billingYear: 2026,
  updatedAt: new Date('2026-09-20T10:00:00Z'),
  hostel: { id: 'h1', name: 'Sunrise Hostel' },
  resident: { roomNumber: '101', user: { firstName: 'Ram', lastName: 'Sharma' } },
};

const buildService = (): OptimizedHostelQueryService => {
  repositoryMap.set(Hostel, { createQueryBuilder: () => stubQueryBuilder(HOSTEL_ROWS) });
  repositoryMap.set(LeaveRequest, {});
  repositoryMap.set(Resident, { count: async () => 5 });
  repositoryMap.set(Room, { find: async () => ROOMS });
  repositoryMap.set(Fee, {
    createQueryBuilder: feeQueryBuilderFactory({
      monthly: { collected: '10500.00' },
      pending: { outstanding: '21000.00', cnt: '3' },
      trend: [
        { billingYear: '2026', billingMonth: '9', collected: '9000.00', outstanding: '1500.00' },
        { billingYear: '2026', billingMonth: '8', collected: '8000.00', outstanding: '0.00' },
      ],
    }),
    find: async () => [RECENT_FEE],
  });
  // Constructed LAST so the class-level repository lookups resolve to the fakes.
  return new OptimizedHostelQueryService();
};

describe('owner dashboard aggregation', () => {
  beforeEach(() => repositoryMap.clear());

  it('returns KPI summary, hostel rows, floors, room mix, revenue trend and recent payments', async () => {
    const dashboard = await buildService().getOwnerHostelDashboard('owner-1');

    // Legacy per-hostel rows stay intact.
    expect(dashboard.hostels).toHaveLength(2);
    expect(dashboard.hostels[0]?.totalActiveResidents).toBe(5);

    // KPI cards rendered by the owner dashboard.
    expect(dashboard.summary).toMatchObject({
      totalResidents: 5,
      residentsOnLeaveToday: 1,
      totalBeds: 8,
      occupiedBeds: 5, // max(active residents 5, rooms.occupied 3)
      availableBeds: 3,
      occupancyRate: 62.5,
      totalRooms: 3,
      availableRooms: 2,
      occupiedRooms: 1,
      monthlyRevenue: 10500,
      pendingPayments: 21000,
      pendingCount: 3,
      totalHostels: 2,
    });

    // Floor overview + room mix.
    expect(dashboard.floorOverview).toEqual([
      { floor: 1, label: 'Floor 1', roomCount: 1 },
      { floor: 2, label: 'Floor 2', roomCount: 1 },
      { floor: 4, label: 'Floor 4', roomCount: 1 },
    ]);
    expect(dashboard.roomMix).toEqual([
      { type: 'TRIPLE', roomCount: 2 },
      { type: 'DOUBLE', roomCount: 1 },
    ]);

    // Revenue trend is oldest → newest with short month labels.
    expect(dashboard.revenueTrend).toEqual([
      { billingYear: 2026, billingMonth: 8, label: 'Aug', collected: 8000, outstanding: 0 },
      { billingYear: 2026, billingMonth: 9, label: 'Sep', collected: 9000, outstanding: 1500 },
    ]);

    // Recent payments flatten the resident/hostel joins into display fields.
    expect(dashboard.recentPayments).toEqual([
      {
        feeId: 'f1',
        residentId: 'res1',
        residentName: 'Ram Sharma',
        hostelId: 'h1',
        hostelName: 'Sunrise Hostel',
        roomNumber: '101',
        paidAmount: 10500,
        totalPayable: 10500,
        status: 'PAID',
        billingMonth: 9,
        billingYear: 2026,
        updatedAt: new Date('2026-09-20T10:00:00Z'),
      },
    ]);
  });

  it('never reports negative availability when occupancy exceeds capacity', async () => {
    repositoryMap.set(Hostel, { createQueryBuilder: () => stubQueryBuilder(HOSTEL_ROWS) });
    repositoryMap.set(LeaveRequest, {});
    repositoryMap.set(Resident, { count: async () => 99 });
    repositoryMap.set(Room, { find: async () => ROOMS });
    repositoryMap.set(Fee, {
      createQueryBuilder: feeQueryBuilderFactory({
        monthly: { collected: '0' },
        pending: { outstanding: '0', cnt: '0' },
        trend: [],
      }),
      find: async () => [],
    });

    const dashboard = await new OptimizedHostelQueryService().getOwnerHostelDashboard('owner-1');

    expect(dashboard.summary.occupiedBeds).toBe(99);
    expect(dashboard.summary.availableBeds).toBe(0);
    expect(dashboard.summary.occupancyRate).toBeGreaterThan(100);
    expect(dashboard.revenueTrend).toEqual([]);
    expect(dashboard.recentPayments).toEqual([]);
  });

  it('returns zeroed KPIs when the owner has no hostel linked to any room/fee', async () => {
    repositoryMap.set(Hostel, { createQueryBuilder: () => stubQueryBuilder([]) });
    repositoryMap.set(LeaveRequest, {});
    repositoryMap.set(Resident, { count: async () => 0 });
    repositoryMap.set(Room, { find: async () => [] });
    repositoryMap.set(Fee, {
      createQueryBuilder: feeQueryBuilderFactory({
        monthly: { collected: '0' },
        pending: { outstanding: '0', cnt: '0' },
        trend: [],
      }),
      find: async () => [],
    });

    const dashboard = await new OptimizedHostelQueryService().getOwnerHostelDashboard('owner-1');

    expect(dashboard.hostels).toEqual([]);
    expect(dashboard.summary).toMatchObject({
      totalResidents: 0,
      totalBeds: 0,
      occupiedBeds: 0,
      availableBeds: 0,
      occupancyRate: 0,
      availableRooms: 0,
      monthlyRevenue: 0,
      pendingPayments: 0,
      totalHostels: 0,
    });
  });
});
