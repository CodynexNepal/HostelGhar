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
    const cacheKey = cacheService.generateKey('public:hostels:list', { page, limit, v: 2 });

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
    const cacheKey = cacheService.generateKey('public:hostel:v2', id);

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
    // v5: + hostel (id/name/type/city/address) + flat (alias of floor) — busts old v4 L1/L2 cache.
    const cacheKey = cacheService.generateKey('hostel:residents', { hostelId: id, v: 5 });

    const {
      data: residents,
      isCached,
      cacheLevel,
    } = await cacheService.wrap(
      cacheKey,
      async () => {
        const list = await this.hostelRepository.findResidents(id);
        // One extra query for latest fee bills + one for room inventory
        // (no N+1 per resident). Residents store roomNumber as plain text,
        // so rooms are matched by (hostelId, roomNumber).
        const [fees, rooms] = await Promise.all([
          this.hostelRepository.findLatestFeesByResidentIds(list.map((r) => r.id)),
          this.hostelRepository.findRoomsByNumbers(
            id,
            list.map((r) => r.roomNumber),
          ),
        ]);
        return { list, fees: [...fees.entries()], rooms: [...rooms.entries()] };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    // Map<...> does not survive JSON (Redis L2) — revive from entries.
    const feeByResident = new Map<string, any>(residents.fees);
    const roomByNumber = new Map<string, any>(residents.rooms);

    // Flatten Resident + User + Hostel join into the exact public shape the
    // frontend needs — nothing else (no password / tokens / docs).
    // Answers: which HOSTEL -> which RESIDENT lives in which FLAT/FLOOR,
    // which ROOM number and which BED number.
    // NOTE: there is no `flat` column in the schema. `flat` here is an alias
    // of Room.floor (the storey/flat level the room sits on).
    const data = residents.list.map((resident) => {
      const firstName = resident.user?.firstName ?? '';
      const lastName = resident.user?.lastName ?? '';
      const latestFee = feeByResident.get(resident.id) ?? null;
      const room = roomByNumber.get(resident.roomNumber?.trim()) ?? null;
      const floor = room?.floor ?? null;
      return {
        id: resident.id,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        email: resident.user?.email ?? null,
        phone: resident.user?.phone ?? null,
        imageUrl: resident.photoUrl ?? resident.user?.avatarUrl ?? null,
        // Which hostel this resident lives in.
        hostelId: resident.hostelId ?? resident.hostel?.id ?? id,
        hostelName: resident.hostel?.name ?? null,
        hostel: resident.hostel
          ? {
              id: resident.hostel.id,
              name: resident.hostel.name,
              type: resident.hostel.type ?? null,
              city: resident.hostel.city ?? null,
              address: resident.hostel.address ?? null,
            }
          : { id: resident.hostelId ?? id, name: null, type: null, city: null, address: null },
        // When the resident profile was created (= joined the hostel).
        joinedDate: resident.createdAt ?? null,
        // Agreed rent from the resident profile (may be null if unset).
        monthlyRent: resident.monthlyRent != null ? Number(resident.monthlyRent) : null,
        // Room assignment from the resident profile (plain text).
        roomNumber: resident.roomNumber ?? null,
        bedNumber: resident.bedNumber ?? null,
        // Enriched from rooms inventory matched by (hostelId, roomNumber).
        // Null when no Room row exists yet for that number (owner hasn't
        // created it in room management) — frontend should show "—".
        roomType: room?.type ?? null,
        floor,
        // `flat` = alias of `floor` (no separate flat column exists).
        flat: floor,
        // Latest generated bill, null if no fee generated yet.
        fee: latestFee
          ? {
              billingMonth: latestFee.billingMonth,
              billingYear: latestFee.billingYear,
              amount: Number(latestFee.amount),
              dueAmount: Number(latestFee.dueAmount),
              totalPayable: Number(latestFee.totalPayable),
              paidAmount: Number(latestFee.paidAmount),
              dueDate: latestFee.dueDate,
              status: latestFee.status,
            }
          : null,
      };
    });

    return { data, isCached, cacheLevel };
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
