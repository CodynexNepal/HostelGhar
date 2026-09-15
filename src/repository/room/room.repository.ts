// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.repository.ts
// PURPOSE: Data access layer for Rooms with owner scoping and pagination.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Room } from '../../entities/room/room.entity';
import { RoomStatus, RoomType } from '../../enum/room.enum';

export interface RoomFilters {
  status?: RoomStatus | undefined;
  type?: RoomType | undefined;
  hostelId?: string | undefined;
  /** Include rooms with hostelId NULL (created before linking). Default true. */
  includeUnlinked?: boolean | undefined;
}

export class RoomRepository {
  private readonly roomRepo: Repository<Room>;

  constructor() {
    this.roomRepo = AppDataSource.getRepository(Room);
  }

  public async createRoom(data: Partial<Room>): Promise<Room> {
    const room = this.roomRepo.create(data);
    return this.roomRepo.save(room);
  }

  public async findById(id: string): Promise<Room | null> {
    return this.roomRepo.findOne({
      where: { id },
      relations: { owner: true, hostel: true },
    });
  }

  public async findByIdAndOwner(id: string, ownerId: string): Promise<Room | null> {
    return this.roomRepo.findOne({
      where: { id, ownerId },
      relations: { owner: true, hostel: true },
    });
  }

  public async findByOwnerRoomNumber(ownerId: string, roomNumber: string): Promise<Room | null> {
    return this.roomRepo.findOne({ where: { ownerId, roomNumber } });
  }

  public async findByOwner(
    ownerId: string,
    filters: RoomFilters = {},
    page: number = 1,
    limit: number = 20,
  ): Promise<[Room[], number]> {
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
      } else {
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

  public async save(room: Room): Promise<Room> {
    return this.roomRepo.save(room);
  }
}
