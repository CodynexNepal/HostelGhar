// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.services.ts
// PURPOSE: Business logic layer for Admin operations.
//          - Owns validation, 3-tier caching, event dispatching, and orchestration.
//          - Follows Controller -> Service -> Repository -> Database architecture.
// ──────────────────────────────────────────────────────────────────────────────

import { AdminRepository } from '../../repository/admin/admin.repository';
import { CreateHostelDto } from '../../dto/hostel/create-hostel.dto';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { SocketEvent } from '../../constant/queue.constants';
import { IROLES } from '../../enum/roles.enum';
import { createPaginatedResponse } from '../../utils/pagination.util';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { processHostelLogoUpload } from '../../functions/hostel-logo.function';

export class AdminService {
  constructor(private readonly adminRepository: AdminRepository) {}

  /**
   * Create a new hostel with optional logo upload in a single transaction-like step
   */
  public async createHostel(
    adminId: string,
    dto: CreateHostelDto,
    logoFile?: Express.Multer.File,
  ): Promise<{ data: Hostel; message: string }> {
    // 1. Create base hostel record (incl. new city/address/phone/email fields)
    const hostel = await this.adminRepository.createHostel({
      name: dto.name,
      type: dto.type,
      city: dto.city ?? null,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      ownerId: dto.ownerId || null,
      createdByAdminId: adminId,
    });

    // 2. If logo is provided during creation, process & upload via imported upload logic.
    // NOTE: Logo failures used to be swallowed (console.warn) leaving logoUrl=null
    // silently — now the hostel is still created but `logoUploadError` is returned
    // so the frontend can show it and retry via POST /hostels/:id/logo.
    let logoUploadError: string | null = null;
    if (logoFile) {
      try {
        const uploadResult = await processHostelLogoUpload(logoFile, hostel.id);
        hostel.logoUrl = uploadResult.url;
        hostel.logoPublicId = uploadResult.publicId;
        await this.adminRepository.saveHostel(hostel);
      } catch (err: any) {
        logoUploadError = err?.message || 'Logo upload failed';
        console.warn(
          `[AdminService] Logo upload failed during hostel creation: ${logoUploadError}`,
        );
      }
    }

    // 3. Invalidate hostels list cache across all tiers (L1 & L2)
    await cacheService.invalidatePattern('hostels');

    // 4. Dispatch event & Realtime live update
    await eventDispatcher.dispatch({
      type: SocketEvent.HOSTEL_UPDATED,
      payload: hostel,
    });

    return {
      data: hostel,
      message: logoUploadError
        ? `Hostel created successfully, but logo upload failed: ${logoUploadError}`
        : 'Hostel created successfully',
      ...(logoUploadError ? { logoUploadError } : {}),
    };
  }

  /**
   * List all hostels with 3-tier caching & standardized pagination.
   * Shape matches what the admin dashboard table needs:
   *   Hostel + Owner + Occupancy (active residents) + Status — one query, no N+1.
   * There is NO capacity/totalBeds column in the schema, so occupancy is
   * reported as `occupiedBeds` with `totalBeds: null` (frontend renders
   * e.g. "3" or "3/—" instead of "undefined/undefined").
   * Status is derived: owner assigned → ACTIVE, else PENDING.
   */
  public async getAllHostels(page: number, limit: number) {
    const cacheKey = cacheService.generateKey('hostels:list', { page, limit, v: 3 });

    // 3-Level Cache: L1 (In-Memory LRU) -> L2 (Redis Distributed) -> L3 (PostgreSQL DB)
    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        const [hostels, total] = await this.adminRepository.findHostelsWithPagination(page, limit);
        const hostelIds = hostels.map((h) => h.id);
        const occupancy = await this.adminRepository.countActiveResidentsByHostel(hostelIds);
        const items = hostels.map((h) => {
          const ownerName = h.owner ? `${h.owner.firstName} ${h.owner.lastName}`.trim() : null;
          return {
            ...h,
            ownerName,
            occupiedBeds: occupancy.get(h.id) ?? 0,
            totalBeds: null as number | null,
            status: h.ownerId ? 'ACTIVE' : 'PENDING',
          };
        });
        return { hostels: items, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 }, // 30s in RAM, 2m in Redis
    );

    return createPaginatedResponse(
      data.hostels,
      data.total,
      { page, limit },
      { isCached, cacheLevel },
    );
  }

  /**
   * Assign or transfer a hostel to an Owner
   */
  public async assignHostelOwner(
    hostelId: string,
    ownerId: string,
    adminId: string,
  ): Promise<
    | { data: Hostel; error?: undefined }
    | { data?: undefined; error: { status: number; message: string } }
  > {
    const [hostel, owner] = await Promise.all([
      this.adminRepository.findHostelById(hostelId),
      this.adminRepository.findUserById(ownerId),
    ]);

    if (!hostel) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
    }

    if (!owner || owner.role !== IROLES.OWNER) {
      return { error: { status: STATUS_CODE.BAD_REQUEST, message: 'Owner user not found' } };
    }

    hostel.ownerId = owner.id;
    const savedHostel = await this.adminRepository.saveHostel(hostel);

    // Invalidate all tiers of hostel caches
    await cacheService.invalidatePattern('hostels');

    // Dispatch realtime update to the assigned owner
    await eventDispatcher.dispatch({
      type: SocketEvent.HOSTEL_UPDATED,
      payload: savedHostel,
      userId: owner.id,
      metadata: { adminId },
    });

    return { data: savedHostel };
  }

  /**
   * Upload or replace a Hostel Logo via Cloudinary
   */
  public async uploadHostelLogo(
    hostelId: string,
    file: Express.Multer.File,
  ): Promise<
    | { data: Hostel; error?: undefined }
    | { data?: undefined; error: { status: number; message: string } }
  > {
    const hostel = await this.adminRepository.findHostelById(hostelId);
    if (!hostel) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
    }

    // Process and upload logo using separate modular upload function
    const uploadResult = await processHostelLogoUpload(file, hostelId, hostel.logoPublicId);

    hostel.logoUrl = uploadResult.url;
    hostel.logoPublicId = uploadResult.publicId;

    const savedHostel = await this.adminRepository.saveHostel(hostel);

    // Invalidate hostel caches across all tiers
    await cacheService.invalidatePattern('hostels');

    return { data: savedHostel };
  }
}

// Named alias for backward compatibility
export const AdminServices = AdminService;
