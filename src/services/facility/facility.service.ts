// ─────────────────────────────────────────────────────────────
// FILE: facility.service.ts
// PURPOSE: Normalized hostel facilities (catalog + junction).
// ─────────────────────────────────────────────────────────────
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { FacilityTag } from '../../enum/facility.enum';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { SocketEvent } from '../../constant/queue.constants';
import { FacilityRepository, FacilityUpsertInput, toFacilitySlug } from '../../repository/facility/facility.repository';

export interface FacilityResponseItem {
  id: string; title: string; slug: string; facilityId: string;
  description: string | null; tag: FacilityTag;
  clientKey: string | null; createdAt: Date; updatedAt: Date;
}
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuidV4 = (v: unknown): v is string => typeof v === 'string' && UUID_V4.test(v.trim());
const normTag = (t: unknown): FacilityTag => {
  const s = typeof t === 'string' ? t.trim().toLowerCase() : '';
  if (s === 'excluded') return FacilityTag.EXCLUDED;
  if (s === 'extra charge' || s === 'extra_charge' || s === 'extra-charge') return FacilityTag.EXTRA_CHARGE;
  return FacilityTag.INCLUDED;
};

export class FacilityService {
  constructor(private readonly repo: FacilityRepository) {}
  private key(hostelId: string): string {
    return cacheService.generateKey('hostel:facilities', { hostelId, v: 1 });
  }
  private shape(rows: Awaited<ReturnType<FacilityRepository['listByHostel']>>): FacilityResponseItem[] {
    return rows.map((r) => ({
      id: r.id, title: r.facility?.title ?? '', slug: r.facility?.slug ?? '',
      facilityId: r.facilityId, description: r.description ?? null, tag: r.tag,
      clientKey: r.clientKey ?? null, createdAt: r.createdAt, updatedAt: r.updatedAt,
    }));
  }
  private async hostelExists(hostelId: string): Promise<boolean> {
    const h = await AppDataSource.getRepository(Hostel).findOne({ where: { id: hostelId }, select: { id: true } });
    return !!h;
  }
  private async invalidate(hostelId: string): Promise<void> {
    await cacheService.invalidatePattern('hostel:facilities');
    await cacheService.invalidatePattern('hostels');
    await cacheService.invalidate(this.key(hostelId)).catch(() => undefined);
  }
  public async list(hostelId: string) {
    if (!isUuidV4(hostelId)) return { error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' } } as const;
    const cacheKey = this.key(hostelId);
    const wrapped = await cacheService.wrap(cacheKey, async () => {
      if (!(await this.hostelExists(hostelId))) return { missing: true as const, rows: [] as FacilityResponseItem[] };
      return { missing: false as const, rows: this.shape(await this.repo.listByHostel(hostelId)) };
    }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
    if (wrapped.data.missing) return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } } as const;
    return { data: wrapped.data.rows, isCached: wrapped.isCached, cacheLevel: wrapped.cacheLevel } as const;
  }
  public async sync(hostelId: string, items: FacilityUpsertInput[]) {
    if (!isUuidV4(hostelId)) return { error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' } } as const;
    if (!(await this.hostelExists(hostelId))) return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } } as const;
    const bySlug = new Map<string, { title: string; description: string | null; tag: FacilityTag; clientKey: string | null }>();
    for (const it of items) {
      const title = it.title?.trim();
      if (!title) continue;
      const slug = toFacilitySlug(title);
      if (!slug) continue;
      bySlug.set(slug, {
        title,
        description: it.description?.trim() ? it.description.trim().slice(0, 500) : null,
        tag: normTag(it.tag),
        clientKey: it.clientKey?.trim() ? it.clientKey.trim().slice(0, 120) : null,
      });
    }
    const existing = await this.repo.findJunctionByHostel(hostelId);
    if (bySlug.size === 0 && items.length === 0) {
      await this.repo.removeJunction(existing);
      await this.invalidate(hostelId);
      return { data: [] as FacilityResponseItem[] } as const;
    }
    const slugs = [...bySlug.keys()];
    const found = await this.repo.findCatalogBySlugs(slugs);
    const catBySlug = new Map(found.map((f) => [f.slug, f]));
    const miss = slugs.filter((s) => !catBySlug.has(s)).map((s) => ({ title: bySlug.get(s)!.title, slug: s }));
    if (miss.length > 0) for (const c of await this.repo.createCatalogEntries(miss)) catBySlug.set(c.slug, c);
    const existByFac = new Map(existing.map((r) => [r.facilityId, r]));
    const wanted = new Set<string>();
    const toSave: Parameters<FacilityRepository['saveJunction']>[0] = [];
    for (const [slug, v] of bySlug) {
      const cat = catBySlug.get(slug);
      if (!cat) continue;
      wanted.add(cat.id);
      const row = existByFac.get(cat.id);
      if (row) {
        let dirty = false;
        if ((row.description ?? null) !== v.description) { row.description = v.description; dirty = true; }
        if (row.tag !== v.tag) { row.tag = v.tag; dirty = true; }
        if (v.clientKey && row.clientKey !== v.clientKey) { row.clientKey = v.clientKey; dirty = true; }
        if (dirty) toSave.push(row);
      } else {
        toSave.push(this.repo.createJunction({ hostelId, facilityId: cat.id, description: v.description, tag: v.tag, clientKey: v.clientKey }));
      }
    }
    const stale = existing.filter((r) => !wanted.has(r.facilityId));
    if (stale.length > 0) await this.repo.removeJunction(stale);
    if (toSave.length > 0) await this.repo.saveJunction(toSave);
    await this.invalidate(hostelId);
    const data = this.shape(await this.repo.listByHostel(hostelId));
    await eventDispatcher.dispatch({ type: SocketEvent.HOSTEL_UPDATED, payload: { hostelId, facilities: data }, hostelId, metadata: { hostelId, f: data.length } }).catch(() => undefined);
    return { data } as const;
  }
  public async add(hostelId: string, input: FacilityUpsertInput) {
    const cur = await this.list(hostelId);
    if ('error' in cur) return cur;
    const merged: FacilityUpsertInput[] = cur.data.map((f) => ({ clientKey: f.clientKey, title: f.title, description: f.description, tag: f.tag }));
    merged.push(input);
    const res = await this.sync(hostelId, merged);
    if ('error' in res) return res;
    const slug = toFacilitySlug(input.title);
    return { data: res.data.find((d) => d.slug === slug) ?? res.data[res.data.length - 1] } as const;
  }
  public async remove(hostelId: string, fkey: string) {
    if (!isUuidV4(hostelId)) return { error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid hostel id — must be UUID v4' } } as const;
    const k = fkey?.trim();
    if (!k) return { error: { status: STATUS_CODE.BAD_REQUEST, message: 'Facility id is required' } } as const;
    if (!(await this.hostelExists(hostelId))) return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } } as const;
    const target = (await this.repo.findJunctionByHostel(hostelId)).find((r) => r.id === k || (r.clientKey ?? '') === k);
    if (!target) return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Facility not found for this hostel' } } as const;
    await this.repo.removeJunction([target]);
    await this.invalidate(hostelId);
    return { data: { removedId: target.id } } as const;
  }
}

