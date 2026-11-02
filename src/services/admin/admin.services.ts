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
import { User } from '../../entities/user.entity';
import { processHostelLogoUpload } from '../../functions/hostel-logo.function';
import { UserRepository } from '../../repository/auth/user.repository';
import { normalizeEmail } from '../../utils/normalize.util';
import { PasswordHasher } from '../../utils/password-hasher.util';
import { CreateOwnerDto } from '../../dto/admin/create-owner.dto';
import { UpdateOwnerDto } from '../../dto/admin/update-owner.dto';
import { markUserLoggedOutAll } from '../../utils/token-blocklist.util';
import { renderOwnerCredentialsEmail } from '../../templates/email.template';
import { JobType } from '../../constant/queue.constants';
import { assertSmtpConfigured } from '../../configs/smtp.config';
import crypto from 'crypto';
import { createHttpError } from '../../utils/createHttpError';
import { imageUploadService } from '../../services/upload/image-upload.service';
import { notificationService } from '../notification/notification.service';
import { SubscriptionRepository } from '../../repository/subscription/subscription.repository';
import { SubscriptionService } from '../subscription/subscription.service';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from '../../enum/subscription.enum';
import { getPlanDefinition } from '../../constant/subscription.constant';

export class AdminService {
  private readonly subscriptionRepository: SubscriptionRepository;
  private readonly subscriptionService: SubscriptionService;

  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly userRepository: UserRepository,
    subscriptionRepository?: SubscriptionRepository,
    subscriptionService?: SubscriptionService,
  ) {
    this.subscriptionRepository = subscriptionRepository || new SubscriptionRepository();
    this.subscriptionService =
      subscriptionService || new SubscriptionService(this.subscriptionRepository);
  }

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

    // If an initial plan is chosen (e.g. ENTERPRISE), activate it immediately
    const chosenPlan = dto.plan || SubscriptionPlan.FREE;
    if (chosenPlan !== SubscriptionPlan.FREE) {
      const planDef = getPlanDefinition(chosenPlan);
      const sub = this.subscriptionRepository.create({
        ownerId: owner.id,
        plan: chosenPlan,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        startDate: new Date(),
        price: planDef.price,
        notes: `Assigned upon owner registration by admin`,
      });
      await this.subscriptionRepository.save(sub);
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
      plan: chosenPlan,
    };
  }

  /**
   * Retrieves all registered hostel owners with their plan and owned hostels.
   */
  public async getOwners(): Promise<any[]> {
    const owners = await this.userRepository.findOwners();
    const ownerIds = owners.map((o) => o.id);
    const hostels = await this.adminRepository.findHostelsByOwnerIds(ownerIds);

    const hostelsByOwner = new Map<string, any[]>();
    for (const h of hostels) {
      if (!h.ownerId) continue;
      const list = hostelsByOwner.get(h.ownerId) ?? [];
      list.push({
        id: h.id,
        name: h.name,
        type: h.type,
        city: h.city,
        address: h.address,
        phone: h.phone,
        email: h.email,
        isActive: h.isActive,
        logoUrl: h.logoUrl,
        createdAt: h.createdAt,
      });
      hostelsByOwner.set(h.ownerId, list);
    }

    const ownersWithDetails = await Promise.all(
      owners.map(async (o) => {
        const activeSub = await this.subscriptionRepository.findActiveSubscription({
          ownerId: o.id,
        });
        const ownerHostels = hostelsByOwner.get(o.id) ?? [];
        const plan = activeSub ? activeSub.plan : SubscriptionPlan.FREE;
        const planDef = getPlanDefinition(plan);
        return {
          id: o.id,
          firstName: o.firstName,
          lastName: o.lastName,
          name: `${o.firstName} ${o.lastName}`.trim(),
          email: o.email,
          phone: o.phone,
          avatarUrl: o.avatarUrl,
          role: o.role,
          plan,
          planName: planDef.name,
          isEnterprise: plan === SubscriptionPlan.ENTERPRISE,
          hostelCount: ownerHostels.length,
          hostels: ownerHostels,
          createdAt: o.createdAt,
        };
      }),
    );

    return ownersWithDetails;
  }

  /**
   * Admin can assign or upgrade an owner to Enterprise (or other plans).
   */
  public async updateOwnerPlan(ownerId: string, plan: SubscriptionPlan) {
    const owner = await this.userRepository.findById(ownerId);
    if (!owner || owner.role?.toLowerCase() !== IROLES.OWNER.toLowerCase()) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Owner not found');
    }

    await this.subscriptionRepository.deactivateExistingActive(ownerId);

    const planDef = getPlanDefinition(plan);
    const sub = this.subscriptionRepository.create({
      ownerId,
      plan,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      startDate: new Date(),
      price: planDef.price,
      notes: `Updated to ${plan} by admin`,
    });

    const saved = await this.subscriptionRepository.save(sub);
    await cacheService.invalidatePattern('subscriptions');
    await cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);

    return {
      plan: saved.plan,
      planName: planDef.name,
      isEnterprise: saved.plan === SubscriptionPlan.ENTERPRISE,
    };
  }

  /**
   * Admin: Get a single owner's profile, active subscription, and all owned hostels.
   */
  public async getOwnerById(ownerId: string) {
    const owner = await this.userRepository.findById(ownerId);
    if (!owner || owner.role?.toLowerCase() !== IROLES.OWNER.toLowerCase()) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Owner not found');
    }

    const activeSub = await this.subscriptionRepository.findActiveSubscription({ ownerId });
    const plan = activeSub ? activeSub.plan : SubscriptionPlan.FREE;
    const planDef = getPlanDefinition(plan);

    const hostels = await this.adminRepository.findHostelsByOwnerId(ownerId);
    const hostelIds = hostels.map((h) => h.id);
    const occupancyMap = await this.adminRepository.getHostelOccupancyByHostel(hostelIds);

    const hostelsWithStats = hostels.map((h) => {
      const stats = occupancyMap.get(h.id);
      return {
        id: h.id,
        name: h.name,
        type: h.type,
        city: h.city,
        address: h.address,
        phone: h.phone,
        email: h.email,
        logoUrl: h.logoUrl,
        isActive: h.isActive,
        suspendedAt: h.suspendedAt,
        suspendReason: h.suspendReason,
        rooms: stats?.rooms ?? 0,
        beds: stats?.beds ?? 0,
        occupied: stats?.occupied ?? 0,
        createdAt: h.createdAt,
      };
    });

    return {
      id: owner.id,
      firstName: owner.firstName,
      lastName: owner.lastName,
      name: `${owner.firstName} ${owner.lastName}`.trim(),
      email: owner.email,
      phone: owner.phone,
      avatarUrl: owner.avatarUrl,
      role: owner.role,
      plan,
      planName: planDef.name,
      isEnterprise: plan === SubscriptionPlan.ENTERPRISE,
      subscription: activeSub
        ? {
            id: activeSub.id,
            plan: activeSub.plan,
            status: activeSub.status,
            startDate: activeSub.startDate,
            endDate: activeSub.endDate,
          }
        : null,
      totalHostels: hostelsWithStats.length,
      hostels: hostelsWithStats,
      createdAt: owner.createdAt,
      updatedAt: owner.updatedAt,
    };
  }

  /**
   * Admin: Edit owner profile details (name, email, phone) and subscription plan.
   */
  public async updateOwner(ownerId: string, dto: UpdateOwnerDto, _adminId: string) {
    const owner = await this.userRepository.findById(ownerId);
    if (!owner || owner.role?.toLowerCase() !== IROLES.OWNER.toLowerCase()) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Owner not found');
    }

    const updates: Partial<User> = {};

    if (dto.email) {
      const normalizedEmail = normalizeEmail(dto.email);
      if (normalizedEmail !== owner.email.toLowerCase()) {
        const existing = await this.userRepository.findByEmail(normalizedEmail);
        if (existing && existing.id !== ownerId) {
          throw createHttpError(
            STATUS_CODE.CONFLICT,
            `Email "${dto.email}" is already in use by another user`,
          );
        }
        updates.email = normalizedEmail;
      }
    }

    if (dto.name) {
      const parts = dto.name.trim().split(/\s+/);
      const firstName = parts[0] ?? '';
      const lastName = parts.slice(1).join(' ') || firstName;
      if (firstName) {
        updates.firstName = firstName;
        updates.lastName = lastName;
      }
    }

    if (dto.phone !== undefined) {
      updates.phone = dto.phone.trim() || null;
    }

    if (Object.keys(updates).length > 0) {
      await this.userRepository.updateUser(ownerId, updates);
    }

    if (dto.plan) {
      await this.updateOwnerPlan(ownerId, dto.plan);
    }

    await cacheService.invalidatePattern('owners');
    await cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);
    await cacheService.invalidatePattern('hostels');

    const updated = await this.getOwnerById(ownerId);
    return {
      message: 'Owner details updated successfully',
      owner: updated,
    };
  }

  /**
   * Admin: Suspend ("spend") owner and all their owned hostels.
   */
  public async suspendOwner(ownerId: string, _adminId: string, reason?: string) {
    const owner = await this.userRepository.findById(ownerId);
    if (!owner || owner.role?.toLowerCase() !== IROLES.OWNER.toLowerCase()) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Owner not found');
    }

    const suspendReason = reason?.trim() || 'Owner account suspended by admin';

    // 1. Suspend all hostels owned by this owner
    await this.adminRepository.setHostelsActiveStatusByOwnerId(ownerId, false, suspendReason);

    // 2. Revoke all active owner tokens immediately
    await markUserLoggedOutAll(ownerId, 7 * 86400);
    await this.userRepository.updateRefreshToken(ownerId, null);

    // 3. Invalidate caches
    await this.invalidateHostelCaches();
    await cacheService.invalidatePattern('owners');
    await cacheService.invalidatePattern('owner:dashboard');
    await cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);

    return {
      message: `Owner ${owner.firstName} ${owner.lastName} and all owned hostels have been suspended.`,
      ownerId,
      reason: suspendReason,
    };
  }

  /**
   * Admin: Reactivate a suspended owner and all their owned hostels.
   */
  public async reactivateOwner(ownerId: string, _adminId: string) {
    const owner = await this.userRepository.findById(ownerId);
    if (!owner || owner.role?.toLowerCase() !== IROLES.OWNER.toLowerCase()) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Owner not found');
    }

    // 1. Reactivate all hostels owned by this owner
    await this.adminRepository.setHostelsActiveStatusByOwnerId(ownerId, true, null);

    // 2. Invalidate caches
    await this.invalidateHostelCaches();
    await cacheService.invalidatePattern('owners');
    await cacheService.invalidatePattern('owner:dashboard');
    await cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);

    return {
      message: `Owner ${owner.firstName} ${owner.lastName} and all owned hostels have been reactivated.`,
      ownerId,
    };
  }

  /**
   * Admin: Delete owner, cleanly unlinking their hostels and deleting subscription.
   */
  public async deleteOwner(ownerId: string, _adminId: string) {
    const owner = await this.userRepository.findById(ownerId);
    if (!owner || owner.role?.toLowerCase() !== IROLES.OWNER.toLowerCase()) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Owner not found');
    }

    // 1. Unassign all hostels owned by this owner to preserve hostels without invalid ownerId
    await this.adminRepository.unassignHostelsByOwnerId(ownerId);

    // 2. Deactivate subscriptions
    await this.subscriptionRepository.deactivateExistingActive(ownerId);

    // 3. Revoke active tokens
    await markUserLoggedOutAll(ownerId, 7 * 86400);

    // 4. Delete user record
    await this.userRepository.deleteUser(ownerId);

    // 5. Invalidate caches
    await this.invalidateHostelCaches();
    await cacheService.invalidatePattern('owners');
    await cacheService.invalidatePattern('owner:dashboard');
    await cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);
    await cacheService.invalidatePattern('subscriptions');

    return {
      message: `Owner ${owner.firstName} ${owner.lastName} has been deleted successfully.`,
      deletedOwnerId: ownerId,
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
    let owner: User | null = null;

    if (dto.ownerId) {
      owner = await this.userRepository.findById(dto.ownerId);
      if (!owner) {
        throw createHttpError(STATUS_CODE.NOT_FOUND, 'Owner with the specified ID was not found');
      }
    } else if (dto.ownerEmail) {
      owner = await this.userRepository.findOwnerByEmail(normalizeEmail(dto.ownerEmail));
      if (!owner) {
        throw createHttpError(
          STATUS_CODE.NOT_FOUND,
          `Owner with email "${dto.ownerEmail}" was not found. Please create the owner account first.`,
        );
      }
    } else if (dto.email) {
      // Legacy fallback: check if hostel contact email matches an existing owner account
      owner = await this.userRepository.findOwnerByEmail(normalizeEmail(dto.email));
    }

    if (!owner) {
      throw createHttpError(
        STATUS_CODE.BAD_REQUEST,
        'Please select an owner or provide a valid owner email to assign this hostel to',
      );
    }

    if (owner.role?.toLowerCase() !== IROLES.OWNER.toLowerCase()) {
      throw createHttpError(
        STATUS_CODE.BAD_REQUEST,
        'The assigned user is not registered as a hostel owner',
      );
    }

    // Check hostel limit according to owner's subscription plan.
    // ENTERPRISE allows unlimited hostels; FREE/BASIC/PRO allows 1.
    const limitCheck = await this.subscriptionService.checkHostelLimit(owner.id, 1);
    if (!limitCheck.allowed) {
      throw createHttpError(
        STATUS_CODE.FORBIDDEN,
        limitCheck.message ||
          'Hostel limit reached for this owner plan. Upgrade to Enterprise to manage multiple hostels.',
      );
    }

    // 1. Create base hostel record with its own contact info and link to the selected owner
    const hostel = await this.adminRepository.createHostel({
      name: dto.name,
      type: dto.type,
      city: dto.city ?? null,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      email: dto.email ? normalizeEmail(dto.email) : null,
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

    // Notify hostel owner
    await notificationService.createNotification({
      userId: owner.id,
      hostelId: hostel.id,
      type: 'HOSTEL_NEW',
      entityType: 'hostel',
      entityId: hostel.id,
      title: 'Hostel Profile Created',
      message: `Your hostel ${hostel.name} has been set up successfully.`,
      targetUrl: '/hostel',
      metadata: { hostelId: hostel.id },
    });

    // Notify all admins
    await notificationService.notifyAdmins({
      type: 'HOSTEL_NEW',
      entityType: 'hostel',
      entityId: hostel.id,
      title: 'New Hostel Registered',
      message: `${hostel.name} was registered by admin.`,
      targetUrl: '/admin/hostels',
      metadata: { hostelId: hostel.id },
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
    const cacheKey = cacheService.generateKey('hostels:list', { page, limit, v: 5 });

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
            isActive: h.isActive,
            suspendedAt: h.suspendedAt ?? null,
            suspendReason: h.suspendReason ?? null,
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
   * Suspend a hostel — hides it from public listings without deleting data.
   * Idempotent: suspending an already-suspended hostel just updates the reason.
   */
  public async suspendHostel(
    hostelId: string,
    adminId: string,
    reason?: string,
  ): Promise<
    | { data: Hostel; error?: undefined }
    | { data?: undefined; error: { status: number; message: string } }
  > {
    const hostel = await this.adminRepository.findHostelById(hostelId);
    if (!hostel) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
    }

    hostel.isActive = false;
    hostel.suspendedAt = new Date();
    hostel.suspendReason = reason?.trim() ? reason.trim() : hostel.suspendReason;
    const savedHostel = await this.adminRepository.saveHostel(hostel);

    await this.invalidateHostelCaches();

    await eventDispatcher.dispatch({
      type: SocketEvent.HOSTEL_UPDATED,
      payload: savedHostel,
      hostelId: savedHostel.id,
      metadata: { adminId, action: 'SUSPEND', reason: savedHostel.suspendReason },
    });

    return { data: savedHostel };
  }

  /**
   * Reactivate a suspended hostel.
   */
  public async reactivateHostel(
    hostelId: string,
    adminId: string,
  ): Promise<
    | { data: Hostel; error?: undefined }
    | { data?: undefined; error: { status: number; message: string } }
  > {
    const hostel = await this.adminRepository.findHostelById(hostelId);
    if (!hostel) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
    }

    hostel.isActive = true;
    hostel.suspendedAt = null;
    hostel.suspendReason = null;
    const savedHostel = await this.adminRepository.saveHostel(hostel);

    await this.invalidateHostelCaches();

    await eventDispatcher.dispatch({
      type: SocketEvent.HOSTEL_UPDATED,
      payload: savedHostel,
      hostelId: savedHostel.id,
      metadata: { adminId, action: 'REACTIVATE' },
    });

    return { data: savedHostel };
  }

  private async invalidateHostelCaches(): Promise<void> {
    // 'hostels' covers admin list/detail keys; 'public:hostels' + 'public:hostel'
    // cover public list/detail keys; 'hostel:leave-types' depends on hostel id.
    await cacheService.invalidatePattern('hostels');
    await cacheService.invalidatePattern('public:hostels');
    await cacheService.invalidatePattern('public:hostel');
    await cacheService.invalidatePattern('hostel:leave-types');
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
