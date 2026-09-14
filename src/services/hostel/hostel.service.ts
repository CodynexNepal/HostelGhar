// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel.service.ts
// PURPOSE: Business logic for hostels with 3-tier caching & pagination.
// ──────────────────────────────────────────────────────────────────────────────

import { HostelRepository } from '../../repository/hostel/hostel.repository';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { createPaginatedResponse } from '../../utils/pagination.util';

export class HostelService {
  constructor(private readonly hostelRepository: HostelRepository) {}

  public async listHostels(page: number, limit: number) {
    const cacheKey = cacheService.generateKey('public:hostels:list', { page, limit });

    // 3-Level Caching: L1 Memory LRU -> L2 Redis -> L3 Database Loader
    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        const [hostels, total] = await this.hostelRepository.findAll(page, limit);
        return { hostels, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 180 }, // 30s RAM, 3m Redis
    );

    return createPaginatedResponse(
      data.hostels,
      data.total,
      { page, limit },
      { isCached, cacheLevel },
    );
  }

  public async getHostel(id: string) {
    const cacheKey = cacheService.generateKey('public:hostel', id);

    const {
      data: hostel,
      isCached,
      cacheLevel,
    } = await cacheService.wrap(cacheKey, async () => await this.hostelRepository.findById(id), {
      l1TtlSeconds: 60,
      l2TtlSeconds: 300,
    });

    if (!hostel) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
    }
    return { data: hostel, isCached, cacheLevel };
  }

  public async getHostelResidents(id: string) {
    const cacheKey = cacheService.generateKey('hostel:residents', id);

    const {
      data: residents,
      isCached,
      cacheLevel,
    } = await cacheService.wrap(
      cacheKey,
      async () => await this.hostelRepository.findResidents(id),
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    return { data: residents, isCached, cacheLevel };
  }

  public async getHostelLeaveTypes(id: string) {
    const cacheKey = cacheService.generateKey('hostel:leave-types', id);

    const {
      data: leaveTypes,
      isCached,
      cacheLevel,
    } = await cacheService.wrap(
      cacheKey,
      async () => await this.hostelRepository.findLeaveTypes(id),
      { l1TtlSeconds: 60, l2TtlSeconds: 300 },
    );

    return { data: leaveTypes, isCached, cacheLevel };
  }
}
