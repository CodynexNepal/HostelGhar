import 'reflect-metadata';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { repositoryMap } = vi.hoisted(() => ({ repositoryMap: new Map<unknown, unknown>() }));

vi.mock('../../src/database/database-source', () => ({
  AppDataSource: {
    getRepository: (entity: unknown) => repositoryMap.get(entity),
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
import { LocationService } from '../../src/services/location/location.service';
import { STATUS_CODE } from '../../src/constant/statusCode.interface';

describe('LocationService', () => {
  const hostelId = 'a38bf07a-b7b1-49dc-85c8-dd5542a8e90a';
  const ownerId = 'b11bf07a-b7b1-49dc-85c8-dd5542a8e90b';
  const otherOwnerId = 'c22bf07a-b7b1-49dc-85c8-dd5542a8e90c';

  let currentHostel: any;

  const fakeHostelRepo = {
    findOne: vi.fn().mockImplementation(async ({ where }) => {
      if (where.id === hostelId) return { ...currentHostel };
      return null;
    }),
    save: vi.fn().mockImplementation(async (hostel) => {
      currentHostel = { ...hostel };
      return currentHostel;
    }),
  };

  beforeEach(() => {
    currentHostel = {
      id: hostelId,
      name: 'Patan Girls Hostel',
      ownerId: ownerId,
      isActive: true,
      address: 'Lagankhel, Lalitpur',
      city: 'Lalitpur',
      latitude: null,
      longitude: null,
      isLocationShared: false,
      locationUpdatedAt: null,
    };
    repositoryMap.clear();
    repositoryMap.set(Hostel, fakeHostelRepo);
  });

  it('allows owner to save valid geographic coordinates and enable sharing', async () => {
    const service = new LocationService();

    const result = await service.updateLocation(
      hostelId,
      { userId: ownerId, role: 'OWNER' },
      {
        latitude: 27.6667,
        longitude: 85.3167,
        isLocationShared: true,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data?.latitude).toBe(27.6667);
    expect(result.data?.longitude).toBe(85.3167);
    expect(result.data?.isLocationShared).toBe(true);
    expect(result.data?.locationUpdatedAt).toBeDefined();
  });

  it('rejects invalid latitude and longitude ranges', async () => {
    const service = new LocationService();

    const invalidLat = await service.updateLocation(
      hostelId,
      { userId: ownerId, role: 'OWNER' },
      {
        latitude: 95.0, // > 90
        longitude: 85.0,
        isLocationShared: false,
      },
    );
    expect(invalidLat.error?.status).toBe(STATUS_CODE.VALIDATION_ERROR);

    const invalidLng = await service.updateLocation(
      hostelId,
      { userId: ownerId, role: 'OWNER' },
      {
        latitude: 27.0,
        longitude: 195.0, // > 180
        isLocationShared: false,
      },
    );
    expect(invalidLng.error?.status).toBe(STATUS_CODE.VALIDATION_ERROR);
  });

  it('prevents enabling sharing without valid coordinates', async () => {
    const service = new LocationService();

    const result = await service.updateLocation(
      hostelId,
      { userId: ownerId, role: 'OWNER' },
      {
        latitude: null,
        longitude: null,
        isLocationShared: true, // Cannot share null coordinates
      },
    );

    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(STATUS_CODE.VALIDATION_ERROR);
  });

  it('masks coordinates in public API when location sharing is disabled', async () => {
    const service = new LocationService();

    // 1. Owner saves coordinates and disables sharing
    await service.updateLocation(
      hostelId,
      { userId: ownerId, role: 'OWNER' },
      {
        latitude: 27.7172,
        longitude: 85.324,
        isLocationShared: false,
      },
    );

    // 2. Public visitor requests location (no user token)
    const publicResult = await service.getLocation(hostelId);
    expect(publicResult.error).toBeUndefined();
    expect(publicResult.data?.isLocationShared).toBe(false);
    expect(publicResult.data?.latitude).toBeNull();
    expect(publicResult.data?.longitude).toBeNull();
    expect(publicResult.data?.address).toBe('Lagankhel, Lalitpur');

    // 3. Authenticated owner requests location -> sees their saved coordinates
    const ownerResult = await service.getLocation(hostelId, { userId: ownerId, role: 'OWNER' });
    expect(ownerResult.error).toBeUndefined();
    expect(ownerResult.data?.latitude).toBe(27.7172);
    expect(ownerResult.data?.longitude).toBe(85.324);
  });

  it('exposes coordinates in public API when location sharing is enabled', async () => {
    const service = new LocationService();

    await service.updateLocation(
      hostelId,
      { userId: ownerId, role: 'OWNER' },
      {
        latitude: 27.7172,
        longitude: 85.324,
        isLocationShared: true,
      },
    );

    const publicResult = await service.getLocation(hostelId);
    expect(publicResult.error).toBeUndefined();
    expect(publicResult.data?.isLocationShared).toBe(true);
    expect(publicResult.data?.latitude).toBe(27.7172);
    expect(publicResult.data?.longitude).toBe(85.324);
  });

  it('forbids unauthorized owner from changing another hostel location', async () => {
    const service = new LocationService();

    const result = await service.updateLocation(
      hostelId,
      { userId: otherOwnerId, role: 'OWNER' },
      {
        latitude: 27.7172,
        longitude: 85.324,
        isLocationShared: true,
      },
    );

    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(STATUS_CODE.FORBIDDEN);
  });
});
