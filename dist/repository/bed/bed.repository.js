"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedRepository = void 0;
const database_source_1 = require("../../database/database-source");
const bed_entity_1 = require("../../entities/bed/bed.entity");
class BedRepository {
    constructor() {
        this.bedRepo = database_source_1.AppDataSource.getRepository(bed_entity_1.Bed);
    }
    async createBed(data) {
        const bed = this.bedRepo.create(data);
        return this.bedRepo.save(bed);
    }
    async findByHostelRoomBed(hostelId, roomId, bedNumber) {
        return this.bedRepo.findOne({
            where: {
                hostelId,
                roomId,
                bedNumber: bedNumber.trim(),
            },
        });
    }
    async findByRoom(roomId) {
        return this.bedRepo.find({
            where: { roomId },
            order: { bedNumber: 'ASC' },
        });
    }
    async findByOwnerAndHostel(ownerId, hostelId) {
        return this.bedRepo.find({
            where: {
                ownerId,
                ...(hostelId ? { hostelId } : {}),
            },
            relations: { hostel: true, room: true },
            order: {
                room: { roomNumber: 'ASC' },
                bedNumber: 'ASC',
            },
        });
    }
    async findById(id) {
        return this.bedRepo.findOne({
            where: { id },
            relations: { hostel: true, room: true, owner: true },
        });
    }
    async findByOwnerAndId(ownerId, id) {
        return this.bedRepo.findOne({
            where: { id, ownerId },
            relations: { hostel: true, room: true, owner: true },
        });
    }
}
exports.BedRepository = BedRepository;
