"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedService = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const room_entity_1 = require("../../entities/room/room.entity");
const database_source_1 = require("../../database/database-source");
const bed_repository_1 = require("../../repository/bed/bed.repository");
const bed_enum_1 = require("../../enum/bed.enum");
class BedService {
    constructor(bedRepository = new bed_repository_1.BedRepository()) {
        this.bedRepository = bedRepository;
    }
    async listBeds(ownerId, hostelId) {
        const beds = await this.bedRepository.findByOwnerAndHostel(ownerId, hostelId);
        return {
            data: beds.map((bed) => ({
                id: bed.id,
                hostelId: bed.hostelId,
                roomId: bed.roomId,
                roomNumber: bed.room?.roomNumber ?? null,
                bedNumber: bed.bedNumber,
                status: bed.status,
                rentAmount: bed.rentAmount,
                createdAt: bed.createdAt,
                updatedAt: bed.updatedAt,
            })),
        };
    }
    async createBed(ownerId, dto) {
        const roomRepo = database_source_1.AppDataSource.getRepository(room_entity_1.Room);
        const roomNumber = dto.roomNumber.trim();
        const bedNumber = dto.bedNumber.trim();
        const room = await roomRepo.findOne({
            where: { roomNumber, ownerId },
            relations: { hostel: true },
        });
        if (!room) {
            return {
                error: {
                    status: statusCode_interface_1.STATUS_CODE.NOT_FOUND,
                    message: `Room ${roomNumber} not found or does not belong to you`,
                },
            };
        }
        if (room.hostelId && room.hostelId !== dto.hostelId) {
            return {
                error: {
                    status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST,
                    message: 'Room does not belong to the selected hostel',
                },
            };
        }
        if (!room.hostelId && dto.hostelId) {
            room.hostelId = dto.hostelId;
            await roomRepo.save(room);
        }
        const existing = await this.bedRepository.findByHostelRoomBed(dto.hostelId, room.id, bedNumber);
        if (existing) {
            return {
                error: {
                    status: statusCode_interface_1.STATUS_CODE.CONFLICT,
                    message: `Bed ${bedNumber} already exists in this room`,
                },
            };
        }
        const bed = await this.bedRepository.createBed({
            hostelId: dto.hostelId,
            roomId: room.id,
            bedNumber,
            status: dto.status ?? bed_enum_1.BedStatus.AVAILABLE,
            rentAmount: dto.rentAmount ?? null,
            ownerId,
        });
        return { data: bed };
    }
}
exports.BedService = BedService;
