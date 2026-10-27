"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.service.ts
// PURPOSE: Room lifecycle owned by an Owner with 3-tier caching & pagination.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomService = void 0;
const room_enum_1 = require("../../enum/room.enum");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const cache_util_1 = require("../../utils/cache.util");
const pagination_util_1 = require("../../utils/pagination.util");
const event_dispatcher_util_1 = require("../../utils/event-dispatcher.util");
const queue_constants_1 = require("../../constant/queue.constants");
const cloudinary_util_1 = require("../../utils/cloudinary.util");
class RoomService {
    constructor(roomRepository) {
        this.roomRepository = roomRepository;
    }
    async createRoom(ownerId, dto, file) {
        const existing = await this.roomRepository.findByOwnerRoomNumber(ownerId, dto.roomNumber);
        if (existing) {
            return {
                error: {
                    status: statusCode_interface_1.STATUS_CODE.CONFLICT,
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
            status: dto.status ?? room_enum_1.RoomStatus.AVAILABLE,
            occupied: 0,
            ownerId,
            hostelId: dto.hostelId ?? null,
        });
        if (file?.buffer) {
            const upload = await cloudinary_util_1.CloudinaryUtil.uploadBuffer(file.buffer, {
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
    async listOwnerRooms(ownerId, filters = {}, page = 1, limit = 20) {
        // v2: hostelId filter now includes owner's hostelId=NULL rooms — bust old cache.
        const cacheKey = cache_util_1.cacheService.generateKey('owner:rooms', {
            ownerId,
            status: filters.status || 'ALL',
            type: filters.type || 'ALL',
            hostelId: filters.hostelId || 'ALL',
            includeUnlinked: filters.includeUnlinked === false ? '0' : '1',
            page,
            limit,
            v: 2,
        });
        const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const [rooms, total] = await this.roomRepository.findByOwner(ownerId, filters, page, limit);
            return { rooms, total };
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return (0, pagination_util_1.createPaginatedResponse)(data.rooms, data.total, { page, limit }, { isCached, cacheLevel });
    }
    async getRoomById(id, ownerId) {
        const cacheKey = cache_util_1.cacheService.generateKey('room:detail', { id, ownerId: ownerId || 'public' });
        const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            const room = ownerId
                ? await this.roomRepository.findByIdAndOwner(id, ownerId)
                : await this.roomRepository.findById(id);
            return { room };
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        if (!data.room) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Room not found' } };
        }
        return { data: data.room, isCached, cacheLevel };
    }
    async updateRoom(id, ownerId, dto, file) {
        const room = await this.roomRepository.findByIdAndOwner(id, ownerId);
        if (!room) {
            return {
                error: {
                    status: statusCode_interface_1.STATUS_CODE.NOT_FOUND,
                    message: 'Room not found or does not belong to you',
                },
            };
        }
        if (dto.roomNumber && dto.roomNumber.trim() !== room.roomNumber) {
            const duplicate = await this.roomRepository.findByOwnerRoomNumber(ownerId, dto.roomNumber.trim());
            if (duplicate && duplicate.id !== room.id) {
                return {
                    error: {
                        status: statusCode_interface_1.STATUS_CODE.CONFLICT,
                        message: `Room number ${dto.roomNumber.trim()} already exists for this owner`,
                    },
                };
            }
            room.roomNumber = dto.roomNumber.trim();
        }
        if (dto.type)
            room.type = dto.type;
        if (dto.capacity !== undefined)
            room.capacity = dto.capacity;
        if (dto.monthlyRent !== undefined)
            room.monthlyRent = dto.monthlyRent;
        if (dto.amenities !== undefined)
            room.amenities = dto.amenities;
        if (dto.floor !== undefined)
            room.floor = dto.floor;
        if (dto.status !== undefined)
            room.status = dto.status;
        if (dto.hostelId !== undefined && dto.hostelId !== null && dto.hostelId !== '') {
            room.hostelId = dto.hostelId;
        }
        if (dto.occupied !== undefined) {
            const capacity = dto.capacity !== undefined ? dto.capacity : room.capacity;
            if (dto.occupied > capacity) {
                return {
                    error: {
                        status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST,
                        message: 'Occupied beds cannot exceed room capacity',
                    },
                };
            }
            room.occupied = dto.occupied;
        }
        if (file?.buffer) {
            if (room.imagePublicId) {
                cloudinary_util_1.CloudinaryUtil.deleteByPublicId(room.imagePublicId).catch((err) => console.warn('[RoomService] Could not delete old room image:', err));
            }
            const upload = await cloudinary_util_1.CloudinaryUtil.uploadBuffer(file.buffer, {
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
        await cache_util_1.cacheService.invalidatePattern('room:detail');
        await this.dispatchRoomEvent(saved, ownerId);
        return { data: saved };
    }
    async invalidateOwnerRoomCaches(ownerId) {
        await cache_util_1.cacheService.invalidatePattern('owner:rooms');
        await cache_util_1.cacheService.invalidatePattern(`owner:rooms:${ownerId}`);
        // Resident form dropdowns (flats/rooms) read from the rooms table.
        await cache_util_1.cacheService.invalidatePattern('owner:form-options:flats');
        await cache_util_1.cacheService.invalidatePattern('owner:form-options:rooms');
        await cache_util_1.cacheService.invalidatePattern('owner:form-options:room-detail');
        // Dashboard KPI cards (Available Rooms, occupancy %, Floor overview,
        // Room mix) are computed from the rooms table — bust them too.
        await cache_util_1.cacheService.invalidatePattern('owner:dashboard');
        await cache_util_1.cacheService.invalidatePattern('analytics:owner');
    }
    async dispatchRoomEvent(room, actorId) {
        const metadata = { actorId, roomId: room.id };
        if (room.hostelId) {
            await event_dispatcher_util_1.eventDispatcher.dispatch({
                type: queue_constants_1.SocketEvent.ROOM_STATUS_CHANGED,
                payload: room,
                userId: room.ownerId,
                hostelId: room.hostelId,
                metadata,
            });
            return;
        }
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.ROOM_STATUS_CHANGED,
            payload: room,
            userId: room.ownerId,
            metadata,
        });
    }
}
exports.RoomService = RoomService;
