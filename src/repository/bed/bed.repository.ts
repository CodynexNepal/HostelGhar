import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Bed } from '../../entities/bed/bed.entity';

export class BedRepository {
  private readonly bedRepo: Repository<Bed>;

  constructor() {
    this.bedRepo = AppDataSource.getRepository(Bed);
  }

  public async createBed(data: Partial<Bed>): Promise<Bed> {
    const bed = this.bedRepo.create(data);
    return this.bedRepo.save(bed);
  }

  public async findByHostelRoomBed(
    hostelId: string,
    roomId: string,
    bedNumber: string,
  ): Promise<Bed | null> {
    return this.bedRepo.findOne({
      where: {
        hostelId,
        roomId,
        bedNumber: bedNumber.trim(),
      },
    });
  }

  public async findByRoom(roomId: string): Promise<Bed[]> {
    return this.bedRepo.find({
      where: { roomId },
      order: { bedNumber: 'ASC' },
    });
  }

  public async findByOwnerAndHostel(ownerId: string, hostelId?: string): Promise<Bed[]> {
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

  public async findById(id: string): Promise<Bed | null> {
    return this.bedRepo.findOne({
      where: { id },
      relations: { hostel: true, room: true, owner: true },
    });
  }

  public async findByOwnerAndId(ownerId: string, id: string): Promise<Bed | null> {
    return this.bedRepo.findOne({
      where: { id, ownerId },
      relations: { hostel: true, room: true, owner: true },
    });
  }
}
