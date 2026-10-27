"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.repository.ts
// PURPOSE: Data access layer for Rooms with owner scoping and pagination.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomRepository = void 0;
const database_source_1 = require("../../database/database-source");
const room_entity_1 = require("../../entities/room/room.entity");
class RoomRepository {
    constructor() {
        this.roomRepo = database_source_1.AppDataSource.getRepository(room_entity_1.Room);
    }
    async createRoom(data) {
        const room = this.roomRepo.create(data);
        return this.roomRepo.save(room);
    }
    async findById(id) {
        return this.roomRepo.findOne({
            where: { id },
            relations: { owner: true, hostel: true },
        });
    }
    async findByIdAndOwner(id, ownerId) {
        return this.roomRepo.findOne({
            where: { id, ownerId },
            relations: { owner: true, hostel: true },
        });
    }
    async findByOwnerRoomNumber(ownerId, roomNumber) {
        return this.roomRepo.findOne({ where: { ownerId, roomNumber } });
    }
    async findByOwner(ownerId, filters = {}, page = 1, limit = 20) {
        const qb = this.roomRepo.createQueryBuilder('room').leftJoinAndSelect('room.hostel', 'hostel');
        qb.where('room.ownerId = :ownerId', { ownerId });
        if (filters.status) {
            qb.andWhere('room.status = :status', { status: filters.status });
        }
        if (filters.type) {
            qb.andWhere('room.type = :type', { type: filters.type });
        }
        if (filters.hostelId) {
            if (filters.includeUnlinked === false) {
                qb.andWhere('room.hostelId = :hostelId', { hostelId: filters.hostelId });
            }
            else {
                // Rooms created before linking a hostel have hostelId NULL — include
                // them too, otherwise owners think rooms they added "disappeared".
                qb.andWhere('(room.hostelId = :hostelId OR room.hostelId IS NULL)', {
                    hostelId: filters.hostelId,
                });
            }
        }
        qb.orderBy('room.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        return await qb.getManyAndCount();
    }
    async save(room) {
        return this.roomRepo.save(room);
    }
}
exports.RoomRepository = RoomRepository;
