// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.service.ts
// PURPOSE: Room lifecycle owned by an Owner with 3-tier caching & pagination.
// ──────────────────────────────────────────────────────────────────────────────

import { CreateRoomDto } from '../../dto/room/create-room.dto';
import { UpdateRoomDto } from '../../dto/room/update-room.dto';
import { Room } from '../../entities/room/room.entity';
import { RoomStatus, RoomType } from '../../enum/room.enum';
import { RoomFilters, RoomRepository } from '../../repository/room/room.repository';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { createPaginatedResponse } from '../../utils/pagination.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { SocketEvent } from '../../constant/queue.constants';
import { CloudinaryUtil } from '../../utils/cloudinary.util';

export class RoomService {
  constructor(private readonly roomRepository: RoomRepository) {}

  public async createRoom(
    ownerId: string,
    dto: CreateRoomDto,
    file?: Express.Multer.File,
  ): Promise<{ data?: Room; error?: { status: number; message: string } }> {
    const existing = await this.roomRepository.findByOwnerRoomNumber(ownerId, dto.roomNumber);
    if (existing) {
      return {
        error: {
          status: STATUS_CODE.CONFLICT,
          message: `Room number ${dto.roomNumber} already exists for this owner`,
        },
      };
    }

    const room = await this.roomRepository.createRoom({
      roomNumber: dto.roomNumber.trim(),
      type: dto.type,
      capacity: dto.capacity,
      monthlyRent: dto.monthlyRent,
      amenities: dto.amenities ?? [],
      floor: dto.floor ?? null,
      status: dto.status ?? RoomStatus.AVAILABLE,
      occupied: 0,
      ownerId,
      hostelId: dto.hostelId ?? null,
    });

    if (file?.buffer) {
      const upload = await CloudinaryUtil.uploadBuffer(file.buffer, {
        folder: 'hostelghar/rooms',
        public_id: `room_${room.id}_${Date.now()}`,
        overwrite: true,
        transformation: [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto:good', fetch_format: 'webp' },
        ],
        tags: ['room_image', `owner_${ownerId}`],
      });
      room.imageUrl = upload.secureUrl;
      room.imagePublicId = upload.publicId;
      const saved = await this.roomRepository.save(room);
      await this.invalidateOwnerRoomCaches(ownerId);
      await this.dispatchRoomEvent(saved, ownerId);
      return { data: saved };
    }

    await this.invalidateOwnerRoomCaches(ownerId);
    await this.dispatchRoomEvent(room, ownerId);
    return { data: room };
  }

  public async listOwnerRooms(
    ownerId: string,
    filters: RoomFilters = {},
    page: number = 1,
    limit: number = 20,
  ) {
    // v2: hostelId filter now includes owner's hostelId=NULL rooms — bust old cache.
    const cacheKey = cacheService.generateKey('owner:rooms', {
      ownerId,
      status: filters.status || 'ALL',
      type: filters.type || 'ALL',
      hostelId: filters.hostelId || 'ALL',
      includeUnlinked: filters.includeUnlinked === false ? '0' : '1',
      page,
      limit,
      v: 2,
    });

    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        const [rooms, total] = await this.roomRepository.findByOwner(ownerId, filters, page, limit);
        return { rooms, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    return createPaginatedResponse(
      data.rooms,
      data.total,
      { page, limit },
      { isCached, cacheLevel },
    );
  }

  public async getRoomById(id: string, ownerId: string) {
    const cacheKey = cacheService.generateKey('room:detail', { id, ownerId: ownerId || 'public' });
    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        const room = ownerId
          ? await this.roomRepository.findByIdAndOwner(id, ownerId)
          : await this.roomRepository.findById(id);
        return { room };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    if (!data.room) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Room not found' } };
    }
    return { data: data.room, isCached, cacheLevel };
  }

  public async updateRoom(
    id: string,
    ownerId: string,
    dto: UpdateRoomDto,
    file?: Express.Multer.File,
  ): Promise<{ data?: Room; error?: { status: number; message: string } }> {
    const room = await this.roomRepository.findByIdAndOwner(id, ownerId);
    if (!room) {
      return {
        error: {
          status: STATUS_CODE.NOT_FOUND,
          message: 'Room not found or does not belong to you',
        },
      };
    }

    if (dto.roomNumber && dto.roomNumber.trim() !== room.roomNumber) {
      const duplicate = await this.roomRepository.findByOwnerRoomNumber(
        ownerId,
        dto.roomNumber.trim(),
      );
      if (duplicate && duplicate.id !== room.id) {
        return {
          error: {
            status: STATUS_CODE.CONFLICT,
            message: `Room number ${dto.roomNumber.trim()} already exists for this owner`,
          },
        };
      }
      room.roomNumber = dto.roomNumber.trim();
    }

    if (dto.type) room.type = dto.type as RoomType;
    if (dto.capacity !== undefined) room.capacity = dto.capacity;
    if (dto.monthlyRent !== undefined) room.monthlyRent = dto.monthlyRent;
    if (dto.amenities !== undefined) room.amenities = dto.amenities;
    if (dto.floor !== undefined) room.floor = dto.floor;
    if (dto.status !== undefined) room.status = dto.status as RoomStatus;

    if (dto.hostelId !== undefined && dto.hostelId !== null && dto.hostelId !== '') {
      room.hostelId = dto.hostelId;
    }

    if (dto.occupied !== undefined) {
      const capacity = dto.capacity !== undefined ? dto.capacity : room.capacity;
      if (dto.occupied > capacity) {
        return {
          error: {
            status: STATUS_CODE.BAD_REQUEST,
            message: 'Occupied beds cannot exceed room capacity',
          },
        };
      }
      room.occupied = dto.occupied;
    }

    if (file?.buffer) {
      if (room.imagePublicId) {
        CloudinaryUtil.deleteByPublicId(room.imagePublicId).catch((err) =>
          console.warn('[RoomService] Could not delete old room image:', err),
        );
      }
      const upload = await CloudinaryUtil.uploadBuffer(file.buffer, {
        folder: 'hostelghar/rooms',
        public_id: `room_${room.id}_${Date.now()}`,
        overwrite: true,
        transformation: [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto:good', fetch_format: 'webp' },
        ],
        tags: ['room_image', `owner_${ownerId}`],
      });
      room.imageUrl = upload.secureUrl;
      room.imagePublicId = upload.publicId;
    }

    const saved = await this.roomRepository.save(room);
    await this.invalidateOwnerRoomCaches(ownerId);
    await cacheService.invalidatePattern('room:detail');
    await this.dispatchRoomEvent(saved, ownerId);
    return { data: saved };
  }

  private async invalidateOwnerRoomCaches(ownerId: string): Promise<void> {
    await cacheService.invalidatePattern('owner:rooms');
    await cacheService.invalidatePattern(`owner:rooms:${ownerId}`);
    // Resident form dropdowns (flats/rooms) read from the rooms table.
    await cacheService.invalidatePattern('owner:form-options:flats');
    await cacheService.invalidatePattern('owner:form-options:rooms');
    await cacheService.invalidatePattern('owner:form-options:room-detail');
  }

  private async dispatchRoomEvent(room: Room, actorId: string): Promise<void> {
    const metadata: Record<string, string> = { actorId, roomId: room.id };
    if (room.hostelId) {
      await eventDispatcher.dispatch({
        type: SocketEvent.ROOM_STATUS_CHANGED,
        payload: room,
        userId: room.ownerId,
        hostelId: room.hostelId,
        metadata,
      });
      return;
    }
    await eventDispatcher.dispatch({
      type: SocketEvent.ROOM_STATUS_CHANGED,
      payload: room,
      userId: room.ownerId,
      metadata,
    });
  }
}
