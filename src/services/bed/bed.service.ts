import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CreateBedDto } from '../../dto/bed/create-bed.dto';
import { Bed } from '../../entities/bed/bed.entity';
import { Room } from '../../entities/room/room.entity';
import { AppDataSource } from '../../database/database-source';
import { BedRepository } from '../../repository/bed/bed.repository';
import { BedStatus } from '../../enum/bed.enum';

export class BedService {
  constructor(private readonly bedRepository: BedRepository = new BedRepository()) {}

  public async listBeds(
    ownerId: string,
    hostelId?: string,
  ): Promise<{
    data: Array<{
      id: string;
      hostelId: string;
      roomId: string;
      roomNumber: string | null;
      bedNumber: string;
      status: BedStatus;
      rentAmount: number | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }> {
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

  public async createBed(
    ownerId: string,
    dto: CreateBedDto,
  ): Promise<{ data?: Bed; error?: { status: number; message: string } }> {
    const roomRepo = AppDataSource.getRepository(Room);
    const roomNumber = dto.roomNumber.trim();
    const bedNumber = dto.bedNumber.trim();

    const room = await roomRepo.findOne({
      where: { roomNumber, ownerId },
      relations: { hostel: true },
    });

    if (!room) {
      return {
        error: {
          status: STATUS_CODE.NOT_FOUND,
          message: `Room ${roomNumber} not found or does not belong to you`,
        },
      };
    }

    if (room.hostelId && room.hostelId !== dto.hostelId) {
      return {
        error: {
          status: STATUS_CODE.BAD_REQUEST,
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
          status: STATUS_CODE.CONFLICT,
          message: `Bed ${bedNumber} already exists in this room`,
        },
      };
    }

    const bed = await this.bedRepository.createBed({
      hostelId: dto.hostelId,
      roomId: room.id,
      bedNumber,
      status: dto.status ?? BedStatus.AVAILABLE,
      rentAmount: dto.rentAmount ?? null,
      ownerId,
    });

    return { data: bed };
  }
}
