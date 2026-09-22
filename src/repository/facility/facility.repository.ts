// ──────────────────────────────────────────────────────────────────────────────
// FILE: facility.repository.ts
// PURPOSE: Data access for normalized facilities.
//          - facilities: canonical catalog keyed by slug
//          - hostel_facilities: per-hostel junction rows (description/tag/clientKey)
// ──────────────────────────────────────────────────────────────────────────────

import { In, Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Facility } from '../../entities/facility/facility.entity';
import { HostelFacility } from '../../entities/facility/hostel-facility.entity';
import { FacilityTag } from '../../enum/facility.enum';

export interface FacilityUpsertInput {
  /** Frontend client key e.g. "security-mu5ofghs" — stored as clientKey. */
  clientKey?: string | null | undefined;
  title: string;
  description?: string | null | undefined;
  tag?: FacilityTag | string | null | undefined;
}

/** Normalize a title into a dedupe slug: " High-Speed Wifi " -> "high-speed-wifi". */
export const toFacilitySlug = (title: string): string =>
  title
    .trim()
    .toLowerCase()
    .replace(/[_'’`]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);

export class FacilityRepository {
  private readonly facilityRepo: Repository<Facility>;
  private readonly hostelFacilityRepo: Repository<HostelFacility>;

  constructor() {
    this.facilityRepo = AppDataSource.getRepository(Facility);
    this.hostelFacilityRepo = AppDataSource.getRepository(HostelFacility);
  }

  public async listByHostel(hostelId: string): Promise<HostelFacility[]> {
    return this.hostelFacilityRepo.find({
      where: { hostelId },
      relations: { facility: true },
      order: { createdAt: 'ASC' },
    });
  }

  public async findCatalogBySlugs(slugs: string[]): Promise<Facility[]> {
    const unique = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))];
    if (unique.length === 0) return [];
    return this.facilityRepo.find({ where: { slug: In(unique) } });
  }

  public async createCatalogEntries(
    entries: Array<{ title: string; slug: string }>,
  ): Promise<Facility[]> {
    if (entries.length === 0) return [];
    const rows = this.facilityRepo.create(
      entries.map((e) => ({ title: e.title.trim(), slug: e.slug })),
    );
    return this.facilityRepo.save(rows);
  }

  public async findJunctionByHostel(hostelId: string): Promise<HostelFacility[]> {
    return this.hostelFacilityRepo.find({ where: { hostelId } });
  }

  public async saveJunction(rows: HostelFacility[]): Promise<HostelFacility[]> {
    return this.hostelFacilityRepo.save(rows);
  }

  public createJunction(data: Partial<HostelFacility>): HostelFacility {
    return this.hostelFacilityRepo.create(data);
  }

  public async removeJunction(rows: HostelFacility[]): Promise<void> {
    if (rows.length === 0) return;
    await this.hostelFacilityRepo.remove(rows);
  }
}
