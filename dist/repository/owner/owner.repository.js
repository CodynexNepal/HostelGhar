"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: owner.repository.ts
// PURPOSE: Data access layer for Owner operations on Hostels, Residents, LeaveTypes, and Fees.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.OwnerRepository = void 0;
const typeorm_1 = require("typeorm");
const database_source_1 = require("../../database/database-source");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const user_entity_1 = require("../../entities/user.entity");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const leave_type_entity_1 = require("../../entities/leave/leave-type.entity");
const room_entity_1 = require("../../entities/room/room.entity");
class OwnerRepository {
    constructor() {
        this.hostelRepo = database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel);
        this.userRepo = database_source_1.AppDataSource.getRepository(user_entity_1.User);
        this.residentRepo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        this.leaveTypeRepo = database_source_1.AppDataSource.getRepository(leave_type_entity_1.LeaveType);
        this.roomRepo = database_source_1.AppDataSource.getRepository(room_entity_1.Room);
    }
    async findHostelByIdAndOwner(hostelId, ownerId) {
        return await this.hostelRepo.findOne({
            where: { id: hostelId, ownerId },
        });
    }
    async findHostelById(hostelId) {
        return await this.hostelRepo.findOne({
            where: { id: hostelId },
        });
    }
    async findUserByEmail(email) {
        return await this.userRepo.findOne({ where: { email } });
    }
    async createUser(userData) {
        const user = this.userRepo.create(userData);
        return await this.userRepo.save(user);
    }
    async createResident(residentData) {
        const resident = this.residentRepo.create(residentData);
        return await this.residentRepo.save(resident);
    }
    async saveResident(resident) {
        return await this.residentRepo.save(resident);
    }
    async saveHostel(hostel) {
        return await this.hostelRepo.save(hostel);
    }
    async saveRoom(room) {
        return await this.roomRepo.save(room);
    }
    /**
     * Single room lookup scoped to a hostel — used to validate the
     * Room number / Bed number picked in the Add-Resident form.
     * roomNumber match is exact after trim (same convention as residents).
     */
    async findRoomByHostelAndNumber(hostelId, roomNumber) {
        const roomNo = roomNumber?.trim();
        if (!roomNo)
            return null;
        return await this.roomRepo.findOne({
            where: { hostelId, roomNumber: roomNo },
        });
    }
    /**
     * Owner's room with NO hostel link (hostelId NULL) matched by room number.
     * Lets the Add-Resident POST adopt rooms created before linking a hostel.
     * Scoped by ownerId so owners can never touch another owner's rooms.
     */
    async findUnlinkedOwnerRoomByNumber(ownerId, roomNumber) {
        const roomNo = roomNumber?.trim();
        if (!roomNo)
            return null;
        return await this.roomRepo.findOne({
            where: { ownerId, roomNumber: roomNo, hostelId: (0, typeorm_1.IsNull)() },
        });
    }
    async findResidentByIdAndOwner(residentId, ownerId) {
        return await this.residentRepo.findOne({
            where: {
                id: residentId,
                hostel: { ownerId },
            },
            relations: { hostel: true, user: true },
        });
    }
    // ─── Resident form dynamic options (hostel → flat → room → rent/bed) ──────
    /**
     * Slim hostel list for the "Hostel" dropdown in the Add-Resident form.
     */
    async findHostelOptionsByOwner(ownerId) {
        return await this.hostelRepo.find({
            where: { ownerId },
            select: { id: true, name: true, type: true, city: true, address: true },
            order: { name: 'ASC' },
        });
    }
    /**
     * All hostels (admin view) for the "Hostel" dropdown.
     */
    async findAllHostelOptions() {
        return await this.hostelRepo.find({
            select: { id: true, name: true, type: true, city: true, address: true },
            order: { name: 'ASC' },
        });
    }
    /**
     * Distinct flat/floor list for the "Flat" dropdown once a hostel is picked.
     * `flat` is an alias of Room.floor (no separate flat column exists).
     * Returns [{ flat, floor, roomCount }] ordered ASC. Rooms with NULL floor
     * are grouped under flat 0 so they are still selectable in the form
     * (rent/bed data for those rooms still loads from the rooms endpoint).
     *
     * IMPORTANT — why this takes ownerId:
     * Rooms can be created WITHOUT a hostel link (hostelId IS NULL, see
     * CreateRoomDto.hostelId optional). A strict `hostelId = X` filter would
     * then return [] even though the owner DID add rooms. When ownerId is
     * given we also include that owner's unlinked rooms so the dropdown
     * never comes back empty for rooms the owner actually created.
     */
    async findFlatOptionsByHostel(hostelId, ownerId) {
        const qb = this.roomRepo
            .createQueryBuilder('room')
            .select('COALESCE(room.floor, 0)', 'flat')
            .addSelect('COUNT(room.id)', 'roomCount');
        if (ownerId) {
            qb.where('(room.hostelId = :hostelId OR (room.hostelId IS NULL AND room.ownerId = :ownerId))', {
                hostelId,
                ownerId,
            });
        }
        else {
            qb.where('room.hostelId = :hostelId', { hostelId });
        }
        const rows = await qb
            .groupBy('COALESCE(room.floor, 0)')
            .orderBy('COALESCE(room.floor, 0)', 'ASC')
            .getRawMany();
        return rows.map((r) => ({
            flat: Number(r.flat),
            floor: Number(r.flat) === 0 ? null : Number(r.flat),
            roomCount: Number(r.roomCount),
        }));
    }
    /**
     * Room list for the "Room number" dropdown once hostel (+ optional flat) is picked.
     * `flat === 0` matches rooms with NULL floor. Ordered by roomNumber ASC.
     * Includes monthlyRent so the frontend can auto-fill "Monthly rent (Rs.)".
     *
     * When ownerId is given, also returns that owner's rooms whose hostelId
     * is NULL (created before linking a hostel) so the dashboard dropdown
     * shows every room the owner added — not just hostel-linked ones.
     * Each returned room carries `hostelLinked` so the UI can badge
     * "unlinked" rooms if it wants.
     */
    async findRoomOptionsByHostel(hostelId, flat, ownerId) {
        const qb = this.roomRepo
            .createQueryBuilder('room')
            .select([
            'room.id',
            'room.roomNumber',
            'room.type',
            'room.capacity',
            'room.monthlyRent',
            'room.floor',
            'room.status',
            'room.occupied',
            'room.hostelId',
            'room.ownerId',
        ])
            .orderBy('room.roomNumber', 'ASC');
        if (ownerId) {
            qb.where('(room.hostelId = :hostelId OR (room.hostelId IS NULL AND room.ownerId = :ownerId))', { hostelId, ownerId });
        }
        else {
            qb.where('room.hostelId = :hostelId', { hostelId });
        }
        if (flat !== undefined && !Number.isNaN(flat)) {
            if (flat === 0) {
                qb.andWhere('room.floor IS NULL');
            }
            else {
                qb.andWhere('room.floor = :flat', { flat });
            }
        }
        const rooms = await qb.getMany();
        return rooms.map((r) => ({
            ...r,
            hostelLinked: r.hostelId != null && String(r.hostelId) === String(hostelId),
        }));
    }
    /**
     * Taken bed numbers per room: Map<roomNumber, takenBedNumbers[]>.
     * Only ACTIVE residents are counted.
     */
    async findTakenBedsByHostel(hostelId, roomNumbers) {
        const unique = [...new Set(roomNumbers.map((n) => n?.trim()).filter(Boolean))];
        if (unique.length === 0)
            return new Map();
        const residents = await this.residentRepo.find({
            where: { hostelId, roomNumber: (0, typeorm_1.In)(unique), isActive: true },
            select: { roomNumber: true, bedNumber: true },
        });
        const byRoom = new Map();
        for (const r of residents) {
            const key = r.roomNumber?.trim();
            if (!key)
                continue;
            if (!byRoom.has(key))
                byRoom.set(key, []);
            if (r.bedNumber?.trim())
                byRoom.get(key).push(r.bedNumber.trim());
        }
        return byRoom;
    }
    /**
     * DEBUG counts: why is my rooms dropdown/list empty?
     * Returns room/hostel ownership breakdown for the logged-in owner.
     */
    async debugRoomsCount(ownerId, hostelId) {
        const myHostels = await this.hostelRepo.find({
            where: { ownerId },
            select: { id: true, name: true },
            order: { name: 'ASC' },
        });
        const mine = await this.roomRepo.count({ where: { ownerId } });
        const unlinkedMine = await this.roomRepo.count({ where: { ownerId, hostelId: (0, typeorm_1.IsNull)() } });
        const sampleMine = await this.roomRepo.find({
            where: { ownerId },
            select: { id: true, roomNumber: true, hostelId: true },
            order: { createdAt: 'DESC' },
            take: 10,
        });
        let requestedHostelOwned = null;
        let linkedToHostel = null;
        let linkedToMyOtherHostels = 0;
        if (hostelId) {
            requestedHostelOwned = myHostels.some((h) => h.id === hostelId);
            linkedToHostel = await this.roomRepo.count({ where: { hostelId } });
            if (myHostels.length > 0) {
                const otherIds = myHostels.map((h) => h.id).filter((id) => id !== hostelId);
                linkedToMyOtherHostels =
                    otherIds.length > 0
                        ? await this.roomRepo.count({ where: { hostelId: (0, typeorm_1.In)(otherIds) } })
                        : 0;
            }
        }
        return {
            myHostels,
            requestedHostelOwned,
            mine,
            linkedToHostel,
            unlinkedMine,
            linkedToMyOtherHostels,
            sampleMine: sampleMine.map((r) => ({
                id: r.id,
                roomNumber: r.roomNumber,
                hostelId: r.hostelId ?? null,
            })),
        };
    }
    async createLeaveType(leaveTypeData) {
        const leaveType = this.leaveTypeRepo.create(leaveTypeData);
        return await this.leaveTypeRepo.save(leaveType);
    }
    async findLeaveTypeByName(hostelId, name) {
        return await this.leaveTypeRepo.findOne({
            where: { hostelId, name },
        });
    }
    async findResidentsByHostel(hostelId) {
        return await this.residentRepo.find({
            where: { hostelId, isActive: true },
            relations: { user: true },
        });
    }
    /**
     * All ACTIVE residents across every hostel owned by `ownerId` (one query, no N+1).
     * Slim projection only — NEVER password / tokens. Includes hostel + user joins
     * so the response can say WHICH hostel each resident lives in.
     * Optional `hostelId` narrows to a single owned hostel (still owner-scoped).
     */
    async findResidentsByOwner(ownerId, hostelId, page = 1, limit = 20) {
        const qb = this.residentRepo
            .createQueryBuilder('resident')
            .innerJoinAndSelect('resident.hostel', 'hostel')
            .innerJoinAndSelect('resident.user', 'user')
            .where('resident.isActive = :isActive', { isActive: true })
            .andWhere('hostel.ownerId = :ownerId', { ownerId });
        if (hostelId) {
            qb.andWhere('resident.hostelId = :hostelId', { hostelId });
        }
        qb.select([
            'resident.id',
            'resident.hostelId',
            'resident.roomNumber',
            'resident.bedNumber',
            'resident.monthlyRent',
            'resident.photoUrl',
            'resident.createdAt',
            'hostel.id',
            'hostel.name',
            'hostel.type',
            'hostel.city',
            'hostel.address',
            'user.id',
            'user.firstName',
            'user.lastName',
            'user.email',
            'user.phone',
            'user.avatarUrl',
        ])
            .orderBy('hostel.name', 'ASC')
            .addOrderBy('resident.roomNumber', 'ASC')
            .skip((page - 1) * limit)
            .take(limit);
        return await qb.getManyAndCount();
    }
    /**
     * Room inventory for enrichment — batch load by (hostelId, roomNumber)
     * since residents store roomNumber as plain text (no FK). One query, no N+1.
     * Key: `${hostelId}::${roomNumber.trim()}` for O(1) lookup in the controller.
     */
    async findRoomsForResidents(residents) {
        const hostelIds = [...new Set(residents.map((r) => r.hostelId).filter(Boolean))];
        const roomNumbers = [
            ...new Set(residents.map((r) => r.roomNumber?.trim()).filter(Boolean)),
        ];
        if (hostelIds.length === 0 || roomNumbers.length === 0)
            return new Map();
        const rooms = await this.roomRepo.find({
            where: { hostelId: (0, typeorm_1.In)(hostelIds), roomNumber: (0, typeorm_1.In)(roomNumbers) },
            select: { id: true, hostelId: true, roomNumber: true, type: true, floor: true },
        });
        const byKey = new Map();
        for (const room of rooms) {
            const key = `${room.hostelId}::${room.roomNumber?.trim()}`;
            if (!byKey.has(key))
                byKey.set(key, room);
        }
        return byKey;
    }
}
exports.OwnerRepository = OwnerRepository;
