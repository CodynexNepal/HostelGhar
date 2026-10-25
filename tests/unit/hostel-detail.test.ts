import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';

const { repositoryMap } = vi.hoisted(() => ({ repositoryMap: new Map<unknown, unknown>() }));

vi.mock('../../src/database/database-source', () => ({
  AppDataSource: {
    getRepository: (entity: unknown) => repositoryMap.get(entity),
    query: vi.fn(),
  },
}));

import { Hostel } from '../../src/entities/hostel/hostel.entity';
import { Resident } from '../../src/entities/resident/resident.entity';
import { LeaveType } from '../../src/entities/leave/leave-type.entity';
import { Fee } from '../../src/entities/fee/fee.entity';
import { Room } from '../../src/entities/room/room.entity';
import { HostelRating } from '../../src/entities/rating/hostel-rating.entity';
import { Bed } from '../../src/entities/bed/bed.entity';
import { HostelFacility } from '../../src/entities/facility/hostel-facility.entity';
import { HostelRepository } from '../../src/repository/hostel/hostel.repository';
import { HostelType } from '../../src/enum/hostel.enum';

const stubQueryBuilder = (rawResult: unknown) => {
  const qb: Record<string, unknown> = {};
  for (const m of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'orderBy',
    'skip',
    'take',
  ]) {
    qb[m] = () => qb;
  }
  qb.getRawOne = async () => rawResult;
  qb.getRawMany = async () => (Array.isArray(rawResult) ? rawResult : [rawResult]);
  return qb;
};

describe('HostelRepository findById', () => {
  const mockHostel = {
    id: 'a38bf07a-b7b1-49dc-85c8-dd5542a8e90a',
    name: 'Infinity Boys Hostel',
    type: HostelType.BOYS,
    city: 'Kathmandu',
    address: 'Banasthali-16, Kathmandu',
    phone: '9817161246',
    email: 'dinesh.tamang1519@gmail.com',
    logoUrl: 'https://example.com/logo.webp',
    isActive: true,
    owner: {
      id: 'owner-uuid',
      firstName: 'Dinesh',
      lastName: 'Tamang',
      email: 'owner@example.com',
      phone: '9876543210',
      avatarUrl: null,
    },
    createdByAdmin: {
      id: 'admin-uuid',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
    },
    hostelFacilities: [],
  };

  it('returns actual beds available out of total beds, hostel fee, and active residents', async () => {
    repositoryMap.clear();

    const fakeHostelRepo = {
      findOne: vi.fn().mockResolvedValue(mockHostel),
    };
    const fakeResidentRepo = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValue(stubQueryBuilder({ count: '44', minRent: '13500' })),
    };
    const fakeBedRepo = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValue(
          stubQueryBuilder({ total: '56', available: '12', occupied: '44', minRent: '13500' }),
        ),
    };
    const fakeRoomRepo = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValue(
          stubQueryBuilder({ totalCapacity: '56', totalOccupied: '44', minRent: '13500' }),
        ),
    };
    const fakeFeeRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(stubQueryBuilder({ minAmount: '13500' })),
    };

    repositoryMap.set(Hostel, fakeHostelRepo);
    repositoryMap.set(Resident, fakeResidentRepo);
    repositoryMap.set(LeaveType, {});
    repositoryMap.set(Fee, fakeFeeRepo);
    repositoryMap.set(Room, fakeRoomRepo);
    repositoryMap.set(HostelRating, {});
    repositoryMap.set(Bed, fakeBedRepo);
    repositoryMap.set(HostelFacility, {});

    const repo = new HostelRepository();
    const result = await repo.findById(mockHostel.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(mockHostel.id);
    expect(result!.name).toBe('Infinity Boys Hostel');

    // Actual beds available out of total beds
    expect(result!.totalBeds).toBe(56);
    expect(result!.availableBeds).toBe(12);
    expect(result!.occupiedBeds).toBe(44);
    expect(result!.beds).toEqual({
      total: 56,
      available: 12,
      occupied: 44,
    });

    // Actual active residents
    expect(result!.activeResidents).toBe(44);
    expect(result!.totalStudents).toBe(44);

    // Actual hostel fee
    expect(result!.hostelFee).toBe(13500);
    expect(result!.monthlyRent).toBe(13500);
    expect(result!.currency).toBe('NPR');
  });

  it('falls back to room inventory when no bed records exist', async () => {
    repositoryMap.clear();

    const fakeHostelRepo = {
      findOne: vi.fn().mockResolvedValue(mockHostel),
    };
    const fakeBedRepo = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValue(
          stubQueryBuilder({ total: '0', available: '0', occupied: '0', minRent: null }),
        ),
    };
    const fakeRoomRepo = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValue(
          stubQueryBuilder({ totalCapacity: '30', totalOccupied: '10', minRent: '11000' }),
        ),
    };
    const fakeResidentRepo = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValue(stubQueryBuilder({ count: '10', minRent: '11000' })),
    };
    const fakeFeeRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(stubQueryBuilder({ minAmount: null })),
    };

    repositoryMap.set(Hostel, fakeHostelRepo);
    repositoryMap.set(Resident, fakeResidentRepo);
    repositoryMap.set(LeaveType, {});
    repositoryMap.set(Fee, fakeFeeRepo);
    repositoryMap.set(Room, fakeRoomRepo);
    repositoryMap.set(HostelRating, {});
    repositoryMap.set(Bed, fakeBedRepo);
    repositoryMap.set(HostelFacility, {});

    const repo = new HostelRepository();
    const result = await repo.findById(mockHostel.id);

    expect(result).not.toBeNull();
    expect(result!.totalBeds).toBe(30);
    expect(result!.availableBeds).toBe(20);
    expect(result!.occupiedBeds).toBe(10);
    expect(result!.activeResidents).toBe(10);
    expect(result!.hostelFee).toBe(11000);
    expect(result!.monthlyRent).toBe(11000);
    expect(result!.currency).toBe('NPR');
  });

  it('returns null if hostel is not found', async () => {
    repositoryMap.clear();

    const fakeHostelRepo = {
      findOne: vi.fn().mockResolvedValue(null),
    };
    repositoryMap.set(Hostel, fakeHostelRepo);
    repositoryMap.set(Resident, { createQueryBuilder: () => stubQueryBuilder(null) });
    repositoryMap.set(LeaveType, {});
    repositoryMap.set(Fee, { createQueryBuilder: () => stubQueryBuilder(null) });
    repositoryMap.set(Room, { createQueryBuilder: () => stubQueryBuilder(null) });
    repositoryMap.set(HostelRating, {});
    repositoryMap.set(Bed, { createQueryBuilder: () => stubQueryBuilder(null) });
    repositoryMap.set(HostelFacility, {});

    const repo = new HostelRepository();
    const result = await repo.findById('non-existent-id');
    expect(result).toBeNull();
  });
});
