// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.repository.ts
// PURPOSE: Data access layer for platform checkout QRs (one row per method).
// ──────────────────────────────────────────────────────────────────────────────

import { DeleteResult, Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { PlatformQr } from '../../entities/platform-qr/platform-qr.entity';
import { PlatformQrMethod } from '../../enum/platform-qr.enum';

export class PlatformQrRepository {
  private get repo(): Repository<PlatformQr> {
    return AppDataSource.getRepository(PlatformQr);
  }

  public async findAll(options?: { onlyActive?: boolean }): Promise<PlatformQr[]> {
    return this.repo.find({
      where: options?.onlyActive !== undefined ? { isActive: options.onlyActive } : {},
      order: { method: 'ASC', createdAt: 'ASC' },
    });
  }

  public async findById(id: string): Promise<PlatformQr | null> {
    return this.repo.findOne({ where: { id } });
  }

  public async findByMethod(method: PlatformQrMethod): Promise<PlatformQr | null> {
    return this.repo.findOne({ where: { method } });
  }

  public create(data: Partial<PlatformQr>): PlatformQr {
    return this.repo.create(data);
  }

  public async save(platformQr: PlatformQr): Promise<PlatformQr> {
    return this.repo.save(platformQr);
  }

  public async delete(id: string): Promise<DeleteResult> {
    return this.repo.delete(id);
  }
}
