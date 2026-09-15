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
import { UserRepository } from '../../repository/auth/user.repository';
import { normalizeEmail } from '../../utils/normalize.util';
import { PasswordHasher } from '../../utils/password-hasher.util';
import { CreateOwnerDto } from '../../dto/admin/create-owner.dto';
import { renderOwnerCredentialsEmail } from '../../templates/email.template';
import { JobType } from '../../constant/queue.constants';
import { assertSmtpConfigured } from '../../configs/smtp.config';
import crypto from 'crypto';
import { createHttpError } from '../../utils/createHttpError';
import { imageUploadService } from '../../services/upload/image-upload.service';

export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly userRepository: UserRepository,
  ) {}

  public async createOwner(dto: CreateOwnerDto, imageFile?: Express.Multer.File) {
    assertSmtpConfigured();
    const email = normalizeEmail(dto.email);
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw createHttpError(STATUS_CODE.CONFLICT, 'A user with this email already exists');
    }

    const temporaryPassword = `${crypto.randomBytes(12).toString('base64url')}Aa1!`;
    const nameParts = dto.name.trim().split(/\s+/);
    const firstName = nameParts.shift() || dto.name.trim();
    const lastName = nameParts.join(' ') || firstName;
    const owner = await this.userRepository.createUser({
      firstName,
      lastName,
      email,
      password: await PasswordHasher.hash(temporaryPassword),
      role: IROLES.OWNER,
      phone: dto.phone.trim(),
    });

    if (imageFile) {
      const image = await imageUploadService.uploadOwnerAvatar(imageFile, owner.id);
      await this.userRepository.updateAvatar(owner.id, image.url, image.publicId);
      owner.avatarUrl = image.url;
      owner.avatarPublicId = image.publicId;
    }

    const template = renderOwnerCredentialsEmail(owner.firstName, owner.email, temporaryPassword);
    await eventDispatcher.queueEmail(JobType.SEND_WELCOME_EMAIL, {
      to: owner.email,
      subject: template.subject,
      body: template.body,
    });

    return {
      id: owner.id,
      firstName: owner.firstName,
      lastName: owner.lastName,
      email: owner.email,
      role: owner.role,
    };
  }

  /**
   * Create a new hostel with optional logo upload in a single transaction-like step
   */
  public async createHostel(
    adminId: string,
    dto: CreateHostelDto,
    logoFile?: Express.Multer.File,
  ): Promise<{ data: Hostel; message: string }> {
    const hostelEmail = dto.email ? normalizeEmail(dto.email) : null;
    if (!hostelEmail) {
      throw createHttpError(
        STATUS_CODE.BAD_REQUEST,
        'Hostel email is required and must match the owner email',
      );
    }

    const owner = await this.userRepository.findOwnerByEmail(hostelEmail);
    if (!owner) {
      throw createHttpError(
        STATUS_CODE.BAD_REQUEST,
        'Create an owner with this email before creating the hostel',
      );
    }
    if (dto.ownerId && dto.ownerId !== owner.id) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Owner ID does not match the hostel email');
    }

    // 1. Create base hostel record (incl. new city/address/phone/email fields)
    const hostel = await this.adminRepository.createHostel({
      name: dto.name,
      type: dto.type,
      city: dto.city ?? null,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      ownerId: owner.id,
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
  * Occupancy is derived from active resident room and bed assignments.
   */
  public async getAllHostels(page: number, limit: number) {
    const cacheKey = cacheService.generateKey('hostels:list', { page, limit, v: 4 });

    // 3-Level Cache: L1 (In-Memory LRU) -> L2 (Redis Distributed) -> L3 (PostgreSQL DB)
    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        const [hostels, total] = await this.adminRepository.findHostelsWithPagination(page, limit);
        const hostelIds = hostels.map((h) => h.id);
        const occupancy = await this.adminRepository.getHostelOccupancyByHostel(hostelIds);
        const items = hostels.map((h) => {
          const hostelOccupancy = occupancy.get(h.id);
          return {
            id: h.id,
            name: h.name,
            type: h.type,
            city: h.city,
            address: h.address,
            phone: h.phone,
            email: h.email,
            logoUrl: h.logoUrl,
            owner: h.owner
              ? {
                  id: h.owner.id,
                  firstName: h.owner.firstName,
                  lastName: h.owner.lastName,
                  email: h.owner.email,
                  phone: h.owner.phone,
                  avatarUrl: h.owner.avatarUrl,
                }
              : null,
            rooms: hostelOccupancy?.rooms ?? 0,
            beds: hostelOccupancy?.beds ?? 0,
            occupied: hostelOccupancy?.occupied ?? 0,
          };
        });
        return { hostels: items, total };
      },
      {
        l1TtlSeconds: 30,
        l2TtlSeconds: 120,
        validateCached: async (cached) => {
          const value = cached as { hostels?: Array<{ id: string }>; total?: number };
          if (!Array.isArray(value.hostels) || typeof value.total !== 'number') return false;

          try {
            const [databaseTotal, existingPageItems] = await Promise.all([
              this.adminRepository.countHostels(),
              this.adminRepository.countExistingHostels(value.hostels.map((hostel) => hostel.id)),
            ]);
            return databaseTotal === value.total && existingPageItems === value.hostels.length;
          } catch {
            // Preserve availability if PostgreSQL is temporarily unavailable.
            return undefined;
          }
        },
      },
    );

    return createPaginatedResponse(
      data.hostels,
      data.total,
      { page, limit },
      { isCached, cacheLevel },
    );
  }

  public async invalidateHostelListCache(): Promise<void> {
    await cacheService.invalidatePattern('hostels');
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
