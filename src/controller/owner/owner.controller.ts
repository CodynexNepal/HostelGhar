// ──────────────────────────────────────────────────────────────────────────────
// FILE: owner.controller.ts
// PURPOSE: Owner controller handling hostel dashboard, resident creation, leave types,
//          manual fee generation triggers, with 3-tier caching & Cloudinary media upload.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { CreateResidentDto } from '../../dto/resident/create-resident.dto';
import { CreateLeaveTypeDto } from '../../dto/leave/create-leave-type.dto';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { IROLES } from '../../enum/roles.enum';

import { PasswordHasher } from '../../utils/password-hasher.util';
import { cacheService } from '../../utils/cache.util';
import { normalizePagination, createPaginatedResponse } from '../../utils/pagination.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { JobType, SocketEvent } from '../../constant/queue.constants';
import { feeService } from '../../services/fee/fee.service';
import { optimizedHostelQueryService } from '../../services/hostel/hostel-query.service';
import { OwnerRepository } from '../../repository/owner/owner.repository';
import { getRequiredParam } from '../../decorators/http.decorator';
import { imageUploadService } from '../../services/upload/image-upload.service';
import { createHttpError } from '../../utils/createHttpError';

export class OwnerController {
  constructor(private readonly ownerRepository: OwnerRepository) {}

  /**
   * Builds the exact dropdown label the frontend renders per room.
   * Available: "Room 103 · double · 1/2 beds · Rs. 11000"
   * Full:      "Room 101 · full (2/2)"
   * Blocked:   "Room 206 · maintenance (1/2)"
   */
  private buildRoomOptionLabel(
    roomNo: string,
    typeLabel: string,
    occupied: number,
    capacity: number,
    rent: number | null,
    status: string,
    available: boolean,
    reason: string | null,
  ): string {
    if (available) {
      return `Room ${roomNo} · ${typeLabel} · ${occupied}/${capacity} beds · Rs. ${rent ?? '—'}`;
    }
    if (reason === 'full') return `Room ${roomNo} · full (${occupied}/${capacity})`;
    return `Room ${roomNo} · ${reason ?? status.toLowerCase()} (${occupied}/${capacity})`;
  }

  /**
   * Get all hostels managed by the owner with aggregated resident counts
   */
  public getMyHostelsDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const cacheKey = cacheService.generateKey('owner:dashboard', ownerId);

      // 3-Level Caching: L1 Memory LRU -> L2 Redis -> L3 Database Loader
      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () => {
          return await optimizedHostelQueryService.getOwnerHostelDashboard(ownerId);
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 60 },
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        isCached,
        cacheLevel,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /owner/residents/form-options/hostels — Hostel dropdown for Add-Resident form.
   * Owner: only own hostels. Admin: all hostels.
   */
  public getResidentFormHostels = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role?.toLowerCase();
      const cacheKey = cacheService.generateKey('owner:form-options:hostels', {
        userId,
        role,
        v: 1,
      });

      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () => {
          if (role === IROLES.ADMIN) {
            return await this.ownerRepository.findAllHostelOptions();
          }
          return await this.ownerRepository.findHostelOptionsByOwner(userId);
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );

      res.status(STATUS_CODE.OK).json({ success: true, isCached, cacheLevel, data });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /owner/residents/form-options/flats?hostelId=<uuid>
   * Flat dropdown once a hostel is picked. `flat` = Room.floor alias.
   */
  public getResidentFormFlats = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role?.toLowerCase();
      const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId.trim() : '';

      if (!hostelId) {
        res
          .status(STATUS_CODE.BAD_REQUEST)
          .json({ success: false, message: 'hostelId query param is required' });
        return;
      }

      if (role !== IROLES.ADMIN) {
        const hostel = await this.ownerRepository.findHostelByIdAndOwner(hostelId, userId);
        if (!hostel) {
          res.status(STATUS_CODE.FORBIDDEN).json({
            success: false,
            message: 'You do not have permission to view rooms for this hostel',
          });
          return;
        }
      }

      // v2: includes owner's hostelId=NULL rooms — busts old cache.
      const cacheKey = cacheService.generateKey('owner:form-options:flats', {
        hostelId,
        ownerId: role === IROLES.ADMIN ? 'admin' : userId,
        v: 2,
      });

      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () =>
          await this.ownerRepository.findFlatOptionsByHostel(
            hostelId,
            role === IROLES.ADMIN ? undefined : userId,
          ),
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );

      res.status(STATUS_CODE.OK).json({ success: true, isCached, cacheLevel, data });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /owner/residents/form-options/rooms?hostelId=<uuid>&flat=<number>
   * Room + Bed dropdowns for Add-Resident, driven LIVE from rooms table
   * (+ active residents for occupancy). Frontend renders `label` directly.
   */
  public getResidentFormRooms = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role?.toLowerCase();
      const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId.trim() : '';
      const flatRaw = typeof req.query.flat === 'string' ? req.query.flat.trim() : '';

      if (!hostelId) {
        res
          .status(STATUS_CODE.BAD_REQUEST)
          .json({ success: false, message: 'hostelId query param is required' });
        return;
      }

      let flat: number | undefined;
      if (flatRaw !== '') {
        const parsed = Number(flatRaw);
        if (!Number.isInteger(parsed)) {
          res
            .status(STATUS_CODE.BAD_REQUEST)
            .json({ success: false, message: 'flat must be an integer floor number' });
          return;
        }
        flat = parsed;
      }

      if (role !== IROLES.ADMIN) {
        const hostel = await this.ownerRepository.findHostelByIdAndOwner(hostelId, userId);
        if (!hostel) {
          res.status(STATUS_CODE.FORBIDDEN).json({
            success: false,
            message: 'You do not have permission to view rooms for this hostel',
          });
          return;
        }
      }

      // v3: includes owner's hostelId=NULL rooms so dropdown is never empty
      // when rooms were created before linking a hostel — busts old cache.
      const cacheKey = cacheService.generateKey('owner:form-options:rooms', {
        hostelId,
        flat: flat ?? 'all',
        ownerId: role === IROLES.ADMIN ? 'admin' : userId,
        v: 3,
      });

      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () =>
          this.buildRoomOptions(hostelId, flat, role === IROLES.ADMIN ? undefined : userId),
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );

      res.status(STATUS_CODE.OK).json({ success: true, isCached, cacheLevel, data });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Builds room + bed dropdown options LIVE from rooms table.
   * Occupancy = ACTIVE residents (source of truth), max() with rooms.occupied
   * column in case it was manually synced higher.
   */
  private buildRoomOptions = async (hostelId: string, flat?: number, ownerId?: string) => {
    const rooms = await this.ownerRepository.findRoomOptionsByHostel(hostelId, flat, ownerId);
    const takenByRoom = await this.ownerRepository.findTakenBedsByHostel(
      hostelId,
      rooms.map((r) => r.roomNumber),
    );

    const options = rooms.map((room) => {
      const roomNo = room.roomNumber?.trim() ?? '';
      const takenBeds = takenByRoom.get(roomNo) ?? [];
      const capacity = Number(room.capacity) || 0;
      const occupiedBeds = Math.max(takenBeds.length, Number(room.occupied) || 0);
      const freeCount = Math.max(capacity - occupiedBeds, 0);
      const monthlyRent = room.monthlyRent != null ? Number(room.monthlyRent) : null;
      const floor = room.floor ?? null;
      const typeLabel = String(room.type ?? '').toLowerCase();
      const statusKey = String(room.status ?? 'AVAILABLE').toUpperCase();

      const takenSet = new Set(takenBeds.map((b) => b.toUpperCase()));
      const beds = Array.from({ length: capacity }, (_, i) => {
        const value = `B${i + 1}`;
        const taken = takenSet.has(value);
        return { value, label: `${value} · Room ${roomNo}`, taken, disabled: taken };
      });
      const suggestedBeds = beds.filter((b) => !b.taken).map((b) => b.value);

      let available = statusKey === 'AVAILABLE' && freeCount > 0;
      let reason: string | null = null;
      if (freeCount <= 0 || statusKey === 'OCCUPIED') {
        available = false;
        reason = 'full';
      } else if (statusKey !== 'AVAILABLE') {
        available = false;
        reason = statusKey.toLowerCase();
      }

      const label = this.buildRoomOptionLabel(
        roomNo,
        typeLabel,
        occupiedBeds,
        capacity,
        monthlyRent,
        statusKey,
        available,
        reason,
      );

      return {
        id: room.id,
        roomNumber: roomNo,
        flat: floor,
        floor,
        type: room.type,
        typeLabel,
        capacity,
        occupiedBeds,
        freeBeds: freeCount,
        freeBedsText: `${freeCount} of ${capacity} bed(s) free.`,
        monthlyRent,
        status: room.status,
        hostelId: room.hostelId ?? null,
        // False when the room was created before linking any hostel.
        // Tell the owner to link it (PATCH /rooms/:id { hostelId }) so it
        // stays hostel-scoped; the dropdown still shows it either way.
        hostelLinked:
          (room as { hostelLinked?: boolean }).hostelLinked ??
          (room.hostelId != null && String(room.hostelId) === String(hostelId)),
        available,
        disabled: !available,
        group: available ? 'available' : 'full',
        reason,
        label,
        takenBeds,
        suggestedBeds,
        suggestedBed: suggestedBeds[0] ?? null,
        beds,
      };
    });

    // Available first (roomNumber ASC), then Full/unavailable — like screenshot.
    options.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
    });
    return options;
  };

  /**
   * GET /owner/residents/form-options/rooms/detail?hostelId=<uuid>&roomNumber=103
   * Single-room detail for the Add-Resident form: call it when the Room
   * dropdown value changes to refresh the Bed dropdown + "X of Y bed(s) free"
   * text + Monthly rent, all straight from the rooms table.
   * Response: the same room-option object as the list endpoint (single object).
   */
  public getResidentFormRoomDetail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role?.toLowerCase();
      const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId.trim() : '';
      const roomNumber =
        typeof req.query.roomNumber === 'string' ? req.query.roomNumber.trim() : '';

      if (!hostelId || !roomNumber) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'hostelId and roomNumber query params are required',
        });
        return;
      }

      if (role !== IROLES.ADMIN) {
        const hostel = await this.ownerRepository.findHostelByIdAndOwner(hostelId, userId);
        if (!hostel) {
          res.status(STATUS_CODE.FORBIDDEN).json({
            success: false,
            message: 'You do not have permission to view rooms for this hostel',
          });
          return;
        }
      }

      const cacheKey = cacheService.generateKey('owner:form-options:room-detail', {
        hostelId,
        roomNumber,
        ownerId: role === IROLES.ADMIN ? 'admin' : userId,
        v: 2,
      });

      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () => {
          const options = await this.buildRoomOptions(
            hostelId,
            undefined,
            role === IROLES.ADMIN ? undefined : userId,
          );
          return options.find((o) => o.roomNumber === roomNumber) ?? null;
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );

      if (!data) {
        res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: `Room ${roomNumber} not found in this hostel`,
        });
        return;
      }

      res.status(STATUS_CODE.OK).json({ success: true, isCached, cacheLevel, data });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /owner/residents — list ALL active residents across every hostel
   * owned by the logged-in owner (admin sees all via same shape when allowed).
   * Each row answers: which HOSTEL -> which RESIDENT lives in which FLAT/FLOOR,
   * which ROOM number and which BED number.
   * Query: ?page=&limit=&hostelId= (optional, still owner-scoped).
   * NOTE: there is no `flat` column — `flat` is an alias of Room.floor.
   */
  public getResidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });
      const hostelId =
        typeof req.query.hostelId === 'string' && req.query.hostelId.trim() !== ''
          ? req.query.hostelId.trim()
          : undefined;

      const cacheKey = cacheService.generateKey('owner:residents', {
        ownerId,
        hostelId: hostelId ?? 'all',
        page,
        limit,
        v: 1,
      });

      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () => {
          const [list, total] = await this.ownerRepository.findResidentsByOwner(
            ownerId,
            hostelId,
            page,
            limit,
          );
          const rooms = await this.ownerRepository.findRoomsForResidents(list);
          return { list, total, rooms: [...rooms.entries()] };
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );

      // Map<...> does not survive JSON (Redis L2) — revive from entries.
      const roomByKey = new Map<string, any>(data.rooms);

      const residents = data.list.map((resident) => {
        const firstName = resident.user?.firstName ?? '';
        const lastName = resident.user?.lastName ?? '';
        const room = roomByKey.get(`${resident.hostelId}::${resident.roomNumber?.trim()}`) ?? null;
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
          hostelId: resident.hostelId,
          hostelName: resident.hostel?.name ?? null,
          hostel: resident.hostel
            ? {
                id: resident.hostel.id,
                name: resident.hostel.name,
                type: resident.hostel.type ?? null,
                city: resident.hostel.city ?? null,
                address: resident.hostel.address ?? null,
              }
            : { id: resident.hostelId, name: null, type: null, city: null, address: null },
          joinedDate: resident.createdAt ?? null,
          monthlyRent: resident.monthlyRent != null ? Number(resident.monthlyRent) : null,
          roomNumber: resident.roomNumber ?? null,
          bedNumber: resident.bedNumber ?? null,
          roomType: room?.type ?? null,
          floor,
          // `flat` = alias of `floor` (no separate flat column exists).
          flat: floor,
        };
      });

      res.status(STATUS_CODE.OK).json({
        success: true,
        ...createPaginatedResponse(
          residents,
          data.total,
          { page, limit },
          { isCached, cacheLevel },
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DEBUG — GET /owner/debug/rooms-count?hostelId=<uuid>
   * Tells you EXACTLY why a dropdown/list is empty:
   *  - who you are (userId/role from JWT)
   *  - how many hostels you own
   *  - does the requested hostel belong to you?
   *  - rooms linked to that hostel vs unlinked (hostelId NULL) vs other owners
   * Remove this route before production.
   */
  public debugRoomsCount = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const hostelId =
        typeof req.query.hostelId === 'string' ? req.query.hostelId.trim() : undefined;
      const counts = await this.ownerRepository.debugRoomsCount(userId, hostelId);
      res.status(STATUS_CODE.OK).json({
        success: true,
        you: { userId, role },
        requestedHostelId: hostelId ?? null,
        ...counts,
        hint:
          counts.requestedHostelOwned === false
            ? 'This hostelId does NOT belong to your login. Use a hostelId from /owner/residents/form-options/hostels, or log in as the owner who owns it.'
            : counts.linkedToHostel === 0 && counts.unlinkedMine > 0
              ? 'Your rooms exist but are NOT linked to this hostel (hostelId NULL). Link via PATCH /rooms/:id { hostelId }, or they still appear in form-options dropdowns.'
              : counts.mine === 0
                ? 'No rooms exist under THIS login at all. You probably created rooms while logged in as a different user (or seed data belongs to another owner).'
                : 'Rooms exist and are linked — if a list still shows [], it is a stale L1/L2 cache entry or a hostelId/status/type filter mismatch.',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a resident account and assign them to a hostel room
   */
  public createResident = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as CreateResidentDto;
      const ownerId = req.user!.userId;
      const role = req.user!.role?.toLowerCase();
      const hostelId = req.hostelId!;
      const nameParts = dto.name.trim().split(/\s+/);
      const firstName = nameParts.shift() || dto.name.trim();
      const lastName = nameParts.join(' ') || firstName;

      // Verify hostel access: owners can only add to their own hostels (admin bypasses).
      const hostel =
        role === IROLES.ADMIN
          ? await this.ownerRepository.findHostelById(hostelId)
          : await this.ownerRepository.findHostelByIdAndOwner(hostelId, ownerId);

      if (!hostel) {
        res.status(STATUS_CODE.FORBIDDEN).json({
          success: false,
          message: 'You do not have permission to add residents to this hostel',
        });
        return;
      }

      // Check if user already exists
      let user = await this.ownerRepository.findUserByEmail(dto.email);
      const tempPassword = dto.password || 'Hostel@123';

      if (!user) {
        const hashedPassword = await PasswordHasher.hash(tempPassword);
        user = await this.ownerRepository.createUser({
          firstName,
          lastName,
          email: dto.email,
          phone: dto.phone,
          password: hashedPassword,
          role: IROLES.RESIDENT,
        });
      }

      // ── Validate room + bed against LIVE rooms-table data ──────────────
      // The dropdowns are dynamic (rooms table + active residents), so the
      // POST must enforce the same rules: room must exist in this hostel
      // (or be an unlinked room of this owner — see dropdown note), must not
      // be MAINTENANCE/RESERVED, must have a free bed, and the picked bed
      // must not already be taken.
      let pickedRoom = await this.ownerRepository.findRoomByHostelAndNumber(
        hostelId,
        dto.roomNumber,
      );
      // Fallback: room created before linking any hostel (hostelId NULL).
      // Adopt it into this hostel on successful assignment below.
      let adoptingUnlinkedRoom = false;
      if (!pickedRoom && role !== IROLES.ADMIN) {
        pickedRoom = await this.ownerRepository.findUnlinkedOwnerRoomByNumber(
          ownerId,
          dto.roomNumber,
        );
        adoptingUnlinkedRoom = pickedRoom != null;
      }
      if (!pickedRoom) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: `Room ${dto.roomNumber.trim()} does not exist in this hostel`,
        });
        return;
      }
      const pickedStatus = String(pickedRoom.status ?? 'AVAILABLE').toUpperCase();
      if (pickedStatus === 'MAINTENANCE' || pickedStatus === 'RESERVED') {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: `Room ${pickedRoom.roomNumber} is currently ${pickedStatus.toLowerCase()} and cannot take residents`,
        });
        return;
      }
      const takenByRoom = await this.ownerRepository.findTakenBedsByHostel(hostelId, [
        pickedRoom.roomNumber,
      ]);
      const takenBeds = takenByRoom.get(pickedRoom.roomNumber?.trim()) ?? [];
      const occupiedCount = Math.max(takenBeds.length, Number(pickedRoom.occupied) || 0);
      const capacity = Number(pickedRoom.capacity) || 0;
      if (occupiedCount >= capacity) {
        res.status(STATUS_CODE.CONFLICT).json({
          success: false,
          message: `Room ${pickedRoom.roomNumber} is full (${occupiedCount}/${capacity})`,
        });
        return;
      }
      const bedTaken = takenBeds.some(
        (b) => b.toUpperCase() === dto.bedNumber.trim().toUpperCase(),
      );
      if (bedTaken) {
        res.status(STATUS_CODE.CONFLICT).json({
          success: false,
          message: `Bed ${dto.bedNumber.trim()} in Room ${pickedRoom.roomNumber} is already taken`,
        });
        return;
      }

      // Dynamic rent default: if the frontend did not send monthlyRent,
      // inherit it from the selected room inventory (so rent stays in sync
      // with Hostel -> Flat -> Room selection).
      let monthlyRent = dto.monthlyRent ?? null;
      if (monthlyRent == null && pickedRoom.monthlyRent != null) {
        monthlyRent = Number(pickedRoom.monthlyRent);
      }
      const roomFlat = pickedRoom.floor != null ? Number(pickedRoom.floor) : null;

      // Create resident profile
      const savedResident = await this.ownerRepository.createResident({
        userId: user.id,
        hostelId,
        roomNumber: pickedRoom.roomNumber,
        bedNumber: dto.bedNumber.trim(),
        monthlyRent,
        isActive: true,
      });

      // Keep rooms.occupied in sync so the dropdown counts stay live
      // even for rooms whose column was previously stale. Adopt unlinked
      // rooms into this hostel so they stay hostel-scoped afterwards.
      const newOccupied = occupiedCount + 1;
      pickedRoom.occupied = newOccupied;
      if (adoptingUnlinkedRoom) {
        pickedRoom.hostelId = hostelId;
      }
      if (newOccupied >= capacity && pickedRoom.status === 'AVAILABLE') {
        pickedRoom.status = 'OCCUPIED' as typeof pickedRoom.status;
      }
      await this.ownerRepository.saveRoom(pickedRoom);

      // Invalidate caches across all tiers.
      // NOTE: keys are `cache:<prefix>:<json>` so patterns must use the prefix
      // (not suffixed IDs) to match every paginated variant.
      await cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);
      await cacheService.invalidatePattern(`owner:residents`);
      await cacheService.invalidatePattern(`owner:form-options:flats`);
      await cacheService.invalidatePattern(`owner:form-options:rooms`);
      await cacheService.invalidatePattern(`owner:form-options:room-detail`);
      await cacheService.invalidatePattern(`hostel:residents`);
      await cacheService.invalidatePattern(`owner:rooms`);
      await cacheService.invalidatePattern(`resident:profile`);

      // Dispatch welcome email via BullMQ
      await eventDispatcher.queueEmail(JobType.SEND_WELCOME_EMAIL, {
        to: user.email,
        subject: `Welcome to ${hostel.name}`,
        body: `Hello ${user.firstName}, you have been added to ${hostel.name} in Room ${dto.roomNumber}. Your temporary password is: ${tempPassword}`,
      });

      // Emit live real-time notification
      req.notifyHostel(hostel.id, SocketEvent.USER_STATUS_CHANGED, {
        residentId: savedResident.id,
        name: `${user.firstName} ${user.lastName}`,
        room: dto.roomNumber,
      });

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Resident created and assigned to hostel successfully',
        data: {
          ...savedResident,
          hostelId,
          hostelName: hostel.name,
          flat: roomFlat,
          floor: roomFlat,
          roomType: pickedRoom.type,
          roomStatus: pickedRoom.status,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload or replace Hostel Logo (Owner restricted to own hostel)
   */
  public uploadHostelLogo = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      const ownerId = req.user!.userId;

      const hostel = await this.ownerRepository.findHostelByIdAndOwner(hostelId, ownerId);
      if (!hostel) {
        throw createHttpError(STATUS_CODE.FORBIDDEN, 'Hostel not found or not owned by you');
      }

      if (!req.file) {
        throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Logo file is required in field "logo"');
      }

      const uploadResult = await imageUploadService.uploadHostelLogo(
        req.file,
        hostel.id,
        hostel.logoPublicId,
      );

      hostel.logoUrl = uploadResult.url;
      hostel.logoPublicId = uploadResult.publicId;
      const savedHostel = await this.ownerRepository.saveHostel(hostel);

      await cacheService.invalidatePattern('hostels');
      await cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Hostel logo uploaded successfully',
        data: savedHostel,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload or replace Student / Resident Photo (with face-center cropping)
   */
  public uploadResidentPhoto = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const residentId = getRequiredParam(req, 'id');
      const ownerId = req.user!.userId;

      const resident = await this.ownerRepository.findResidentByIdAndOwner(residentId, ownerId);
      if (!resident) {
        throw createHttpError(
          STATUS_CODE.FORBIDDEN,
          'Resident not found or does not belong to your hostel',
        );
      }

      if (!req.file) {
        throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Photo file is required in field "photo"');
      }

      const uploadResult = await imageUploadService.uploadStudentPhoto(
        req.file,
        resident.id,
        resident.photoPublicId,
      );

      resident.photoUrl = uploadResult.url;
      resident.photoPublicId = uploadResult.publicId;
      const savedResident = await this.ownerRepository.saveResident(resident);

      // NOTE: keys are `cache:<prefix>:<json>`, so invalidate by prefix.
      await cacheService.invalidatePattern(`hostel:residents`);
      await cacheService.invalidatePattern(`owner:residents`);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Student photo uploaded successfully',
        data: savedResident,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload or replace Student / Resident Identification Document
   */
  public uploadResidentDocument = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const residentId = getRequiredParam(req, 'id');
      const ownerId = req.user!.userId;

      const resident = await this.ownerRepository.findResidentByIdAndOwner(residentId, ownerId);
      if (!resident) {
        throw createHttpError(
          STATUS_CODE.FORBIDDEN,
          'Resident not found or does not belong to your hostel',
        );
      }

      if (!req.file) {
        throw createHttpError(
          STATUS_CODE.BAD_REQUEST,
          'Document file is required in field "document"',
        );
      }

      const uploadResult = await imageUploadService.uploadStudentDocument(
        req.file,
        resident.id,
        resident.documentPublicId,
      );

      resident.documentUrl = uploadResult.url;
      resident.documentPublicId = uploadResult.publicId;
      const savedResident = await this.ownerRepository.saveResident(resident);

      // NOTE: keys are `cache:<prefix>:<json>`, so invalidate by prefix.
      await cacheService.invalidatePattern(`hostel:residents`);
      await cacheService.invalidatePattern(`owner:residents`);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Student document uploaded successfully',
        data: savedResident,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a leave type policy for a hostel
   */
  public createLeaveType = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as CreateLeaveTypeDto;
      const ownerId = req.user!.userId;

      // Verify hostel ownership
      const hostel = await this.ownerRepository.findHostelByIdAndOwner(dto.hostelId, ownerId);

      if (!hostel) {
        res.status(STATUS_CODE.FORBIDDEN).json({
          success: false,
          message: 'You can only configure leave policies for your own hostels',
        });
        return;
      }

      const savedLeaveType = await this.ownerRepository.createLeaveType({
        hostelId: dto.hostelId,
        name: dto.name,
        maxDays: dto.maxDays || 7,
        requiresParentApproval: dto.requiresParentApproval || false,
      });

      // Invalidate cache across all tiers
      await cacheService.invalidatePattern(`leave:types:${dto.hostelId}`);

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Leave type policy created successfully',
        data: savedLeaveType,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Trigger monthly fee batch generation manually
   */
  public triggerMonthlyFees = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await feeService.generateMonthlyFeesForAllHostels();
      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Monthly fees generated and dispatched to residents',
        result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const ownerController = new OwnerController(new OwnerRepository());
