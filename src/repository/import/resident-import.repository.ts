// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident-import.repository.ts
// PURPOSE: Data access for ResidentImport history rows (owner-scoped, paginated).
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { ResidentImport, ResidentImportStatus } from '../../entities/import/resident-import.entity';

export class ResidentImportRepository {
  private readonly importRepo: Repository<ResidentImport>;

  constructor() {
    this.importRepo = AppDataSource.getRepository(ResidentImport);
  }

  public create(data: Partial<ResidentImport>): ResidentImport {
    return this.importRepo.create(data);
  }

  public async save(record: ResidentImport): Promise<ResidentImport> {
    return await this.importRepo.save(record);
  }

  public async findById(id: string): Promise<ResidentImport | null> {
    return await this.importRepo.findOne({ where: { id } });
  }

  public async findByIdempotency(
    hostelId: string,
    requestedBy: string,
    idempotencyKey: string,
  ): Promise<ResidentImport | null> {
    return await this.importRepo.findOne({
      where: { hostelId, requestedBy, idempotencyKey },
      order: { createdAt: 'DESC' },
    });
  }

  public async countActiveToday(requestedBy: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return await this.importRepo
      .createQueryBuilder('ri')
      .where('ri.requestedBy = :requestedBy', { requestedBy })
      .andWhere('ri.createdAt >= :startOfDay', { startOfDay })
      .andWhere('ri.status IN (:...statuses)', {
        statuses: [ResidentImportStatus.QUEUED, ResidentImportStatus.PROCESSING],
      })
      .getCount();
  }

  public async findHistoryByOwner(
    ownerId: string,
    page: number,
    limit: number,
    hostelId?: string,
  ): Promise<[ResidentImport[], number]> {
    const qb = this.importRepo
      .createQueryBuilder('ri')
      .leftJoinAndSelect('ri.hostel', 'hostel')
      .where('ri.requestedBy = :ownerId', { ownerId })
      .orderBy('ri.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (hostelId) {
      qb.andWhere('ri.hostelId = :hostelId', { hostelId });
    }

    return await qb.getManyAndCount();
  }

  public async findHistoryByHostel(
    hostelId: string,
    page: number,
    limit: number,
  ): Promise<[ResidentImport[], number]> {
    return await this.importRepo.findAndCount({
      where: { hostelId },
      order: { createdAt: 'DESC' },
      relations: { hostel: true },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
