"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.services.ts
// PURPOSE: Business logic layer for Admin operations.
//          - Owns validation, 3-tier caching, event dispatching, and orchestration.
//          - Follows Controller -> Service -> Repository -> Database architecture.
// ──────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminServices = exports.AdminService = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const cache_util_1 = require("../../utils/cache.util");
const event_dispatcher_util_1 = require("../../utils/event-dispatcher.util");
const queue_constants_1 = require("../../constant/queue.constants");
const roles_enum_1 = require("../../enum/roles.enum");
const pagination_util_1 = require("../../utils/pagination.util");
const hostel_logo_function_1 = require("../../functions/hostel-logo.function");
const normalize_util_1 = require("../../utils/normalize.util");
const password_hasher_util_1 = require("../../utils/password-hasher.util");
const token_blocklist_util_1 = require("../../utils/token-blocklist.util");
const email_template_1 = require("../../templates/email.template");
const queue_constants_2 = require("../../constant/queue.constants");
const smtp_config_1 = require("../../configs/smtp.config");
const crypto_1 = __importDefault(require("crypto"));
const createHttpError_1 = require("../../utils/createHttpError");
const image_upload_service_1 = require("../../services/upload/image-upload.service");
const notification_service_1 = require("../notification/notification.service");
const subscription_repository_1 = require("../../repository/subscription/subscription.repository");
const subscription_service_1 = require("../subscription/subscription.service");
const subscription_enum_1 = require("../../enum/subscription.enum");
const subscription_constant_1 = require("../../constant/subscription.constant");
class AdminService {
    constructor(adminRepository, userRepository, subscriptionRepository, subscriptionService) {
        this.adminRepository = adminRepository;
        this.userRepository = userRepository;
        this.subscriptionRepository = subscriptionRepository || new subscription_repository_1.SubscriptionRepository();
        this.subscriptionService =
            subscriptionService || new subscription_service_1.SubscriptionService(this.subscriptionRepository);
    }
    async createOwner(dto, imageFile) {
        (0, smtp_config_1.assertSmtpConfigured)();
        const email = (0, normalize_util_1.normalizeEmail)(dto.email);
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.CONFLICT, 'A user with this email already exists');
        }
        const temporaryPassword = `${crypto_1.default.randomBytes(12).toString('base64url')}Aa1!`;
        const nameParts = dto.name.trim().split(/\s+/);
        const firstName = nameParts.shift() || dto.name.trim();
        const lastName = nameParts.join(' ') || firstName;
        const owner = await this.userRepository.createUser({
            firstName,
            lastName,
            email,
            password: await password_hasher_util_1.PasswordHasher.hash(temporaryPassword),
            role: roles_enum_1.IROLES.OWNER,
            phone: dto.phone.trim(),
        });
        if (imageFile) {
            const image = await image_upload_service_1.imageUploadService.uploadOwnerAvatar(imageFile, owner.id);
            await this.userRepository.updateAvatar(owner.id, image.url, image.publicId);
            owner.avatarUrl = image.url;
            owner.avatarPublicId = image.publicId;
        }
        // If an initial plan is chosen (e.g. ENTERPRISE), activate it immediately
        const chosenPlan = dto.plan || subscription_enum_1.SubscriptionPlan.FREE;
        if (chosenPlan !== subscription_enum_1.SubscriptionPlan.FREE) {
            const planDef = (0, subscription_constant_1.getPlanDefinition)(chosenPlan);
            const sub = this.subscriptionRepository.create({
                ownerId: owner.id,
                plan: chosenPlan,
                status: subscription_enum_1.SubscriptionStatus.ACTIVE,
                billingCycle: subscription_enum_1.BillingCycle.MONTHLY,
                startDate: new Date(),
                price: planDef.price,
                notes: `Assigned upon owner registration by admin`,
            });
            await this.subscriptionRepository.save(sub);
        }
        const template = (0, email_template_1.renderOwnerCredentialsEmail)(owner.firstName, owner.email, temporaryPassword);
        await event_dispatcher_util_1.eventDispatcher.queueEmail(queue_constants_2.JobType.SEND_WELCOME_EMAIL, {
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
    async getOwners() {
        const owners = await this.userRepository.findOwners();
        const ownerIds = owners.map((o) => o.id);
        const hostels = await this.adminRepository.findHostelsByOwnerIds(ownerIds);
        const hostelsByOwner = new Map();
        for (const h of hostels) {
            if (!h.ownerId)
                continue;
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
        const ownersWithDetails = await Promise.all(owners.map(async (o) => {
            const activeSub = await this.subscriptionRepository.findActiveSubscription({
                ownerId: o.id,
            });
            const ownerHostels = hostelsByOwner.get(o.id) ?? [];
            const plan = activeSub ? activeSub.plan : subscription_enum_1.SubscriptionPlan.FREE;
            const planDef = (0, subscription_constant_1.getPlanDefinition)(plan);
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
                isEnterprise: plan === subscription_enum_1.SubscriptionPlan.ENTERPRISE,
                hostelCount: ownerHostels.length,
                hostels: ownerHostels,
                createdAt: o.createdAt,
            };
        }));
        return ownersWithDetails;
    }
    /**
     * Admin can assign or upgrade an owner to Enterprise (or other plans).
     */
    async updateOwnerPlan(ownerId, plan) {
        const owner = await this.userRepository.findById(ownerId);
        if (!owner || owner.role?.toLowerCase() !== roles_enum_1.IROLES.OWNER.toLowerCase()) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Owner not found');
        }
        await this.subscriptionRepository.deactivateExistingActive(ownerId);
        const planDef = (0, subscription_constant_1.getPlanDefinition)(plan);
        const sub = this.subscriptionRepository.create({
            ownerId,
            plan,
            status: subscription_enum_1.SubscriptionStatus.ACTIVE,
            billingCycle: subscription_enum_1.BillingCycle.MONTHLY,
            startDate: new Date(),
            price: planDef.price,
            notes: `Updated to ${plan} by admin`,
        });
        const saved = await this.subscriptionRepository.save(sub);
        await cache_util_1.cacheService.invalidatePattern('subscriptions');
        await cache_util_1.cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);
        return {
            plan: saved.plan,
            planName: planDef.name,
            isEnterprise: saved.plan === subscription_enum_1.SubscriptionPlan.ENTERPRISE,
        };
    }
    /**
     * Admin: Get a single owner's profile, active subscription, and all owned hostels.
     */
    async getOwnerById(ownerId) {
        const owner = await this.userRepository.findById(ownerId);
        if (!owner || owner.role?.toLowerCase() !== roles_enum_1.IROLES.OWNER.toLowerCase()) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Owner not found');
        }
        const activeSub = await this.subscriptionRepository.findActiveSubscription({ ownerId });
        const plan = activeSub ? activeSub.plan : subscription_enum_1.SubscriptionPlan.FREE;
        const planDef = (0, subscription_constant_1.getPlanDefinition)(plan);
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
            isEnterprise: plan === subscription_enum_1.SubscriptionPlan.ENTERPRISE,
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
    async updateOwner(ownerId, dto, _adminId) {
        const owner = await this.userRepository.findById(ownerId);
        if (!owner || owner.role?.toLowerCase() !== roles_enum_1.IROLES.OWNER.toLowerCase()) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Owner not found');
        }
        const updates = {};
        if (dto.email) {
            const normalizedEmail = (0, normalize_util_1.normalizeEmail)(dto.email);
            if (normalizedEmail !== owner.email.toLowerCase()) {
                const existing = await this.userRepository.findByEmail(normalizedEmail);
                if (existing && existing.id !== ownerId) {
                    throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.CONFLICT, `Email "${dto.email}" is already in use by another user`);
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
        await cache_util_1.cacheService.invalidatePattern('owners');
        await cache_util_1.cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);
        await cache_util_1.cacheService.invalidatePattern('hostels');
        const updated = await this.getOwnerById(ownerId);
        return {
            message: 'Owner details updated successfully',
            owner: updated,
        };
    }
    /**
     * Admin: Suspend ("spend") owner and all their owned hostels.
     */
    async suspendOwner(ownerId, _adminId, reason) {
        const owner = await this.userRepository.findById(ownerId);
        if (!owner || owner.role?.toLowerCase() !== roles_enum_1.IROLES.OWNER.toLowerCase()) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Owner not found');
        }
        const suspendReason = reason?.trim() || 'Owner account suspended by admin';
        // 1. Suspend all hostels owned by this owner
        await this.adminRepository.setHostelsActiveStatusByOwnerId(ownerId, false, suspendReason);
        // 2. Revoke all active owner tokens immediately
        await (0, token_blocklist_util_1.markUserLoggedOutAll)(ownerId, 7 * 86400);
        await this.userRepository.updateRefreshToken(ownerId, null);
        // 3. Invalidate caches
        await this.invalidateHostelCaches();
        await cache_util_1.cacheService.invalidatePattern('owners');
        await cache_util_1.cacheService.invalidatePattern('owner:dashboard');
        await cache_util_1.cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);
        return {
            message: `Owner ${owner.firstName} ${owner.lastName} and all owned hostels have been suspended.`,
            ownerId,
            reason: suspendReason,
        };
    }
    /**
     * Admin: Reactivate a suspended owner and all their owned hostels.
     */
    async reactivateOwner(ownerId, _adminId) {
        const owner = await this.userRepository.findById(ownerId);
        if (!owner || owner.role?.toLowerCase() !== roles_enum_1.IROLES.OWNER.toLowerCase()) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Owner not found');
        }
        // 1. Reactivate all hostels owned by this owner
        await this.adminRepository.setHostelsActiveStatusByOwnerId(ownerId, true, null);
        // 2. Invalidate caches
        await this.invalidateHostelCaches();
        await cache_util_1.cacheService.invalidatePattern('owners');
        await cache_util_1.cacheService.invalidatePattern('owner:dashboard');
        await cache_util_1.cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);
        return {
            message: `Owner ${owner.firstName} ${owner.lastName} and all owned hostels have been reactivated.`,
            ownerId,
        };
    }
    /**
     * Admin: Delete owner, cleanly unlinking their hostels and deleting subscription.
     */
    async deleteOwner(ownerId, _adminId) {
        const owner = await this.userRepository.findById(ownerId);
        if (!owner || owner.role?.toLowerCase() !== roles_enum_1.IROLES.OWNER.toLowerCase()) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Owner not found');
        }
        // 1. Unassign all hostels owned by this owner to preserve hostels without invalid ownerId
        await this.adminRepository.unassignHostelsByOwnerId(ownerId);
        // 2. Deactivate subscriptions
        await this.subscriptionRepository.deactivateExistingActive(ownerId);
        // 3. Revoke active tokens
        await (0, token_blocklist_util_1.markUserLoggedOutAll)(ownerId, 7 * 86400);
        // 4. Delete user record
        await this.userRepository.deleteUser(ownerId);
        // 5. Invalidate caches
        await this.invalidateHostelCaches();
        await cache_util_1.cacheService.invalidatePattern('owners');
        await cache_util_1.cacheService.invalidatePattern('owner:dashboard');
        await cache_util_1.cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);
        await cache_util_1.cacheService.invalidatePattern('subscriptions');
        return {
            message: `Owner ${owner.firstName} ${owner.lastName} has been deleted successfully.`,
            deletedOwnerId: ownerId,
        };
    }
    /**
     * Create a new hostel with optional logo upload in a single transaction-like step
     */
    async createHostel(adminId, dto, logoFile) {
        let owner = null;
        if (dto.ownerId) {
            owner = await this.userRepository.findById(dto.ownerId);
            if (!owner) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Owner with the specified ID was not found');
            }
        }
        else if (dto.ownerEmail) {
            owner = await this.userRepository.findOwnerByEmail((0, normalize_util_1.normalizeEmail)(dto.ownerEmail));
            if (!owner) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, `Owner with email "${dto.ownerEmail}" was not found. Please create the owner account first.`);
            }
        }
        else if (dto.email) {
            // Legacy fallback: check if hostel contact email matches an existing owner account
            owner = await this.userRepository.findOwnerByEmail((0, normalize_util_1.normalizeEmail)(dto.email));
        }
        if (!owner) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Please select an owner or provide a valid owner email to assign this hostel to');
        }
        if (owner.role?.toLowerCase() !== roles_enum_1.IROLES.OWNER.toLowerCase()) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'The assigned user is not registered as a hostel owner');
        }
        // Check hostel limit according to owner's subscription plan.
        // ENTERPRISE allows unlimited hostels; FREE/BASIC/PRO allows 1.
        const limitCheck = await this.subscriptionService.checkHostelLimit(owner.id, 1);
        if (!limitCheck.allowed) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, limitCheck.message ||
                'Hostel limit reached for this owner plan. Upgrade to Enterprise to manage multiple hostels.');
        }
        // 1. Create base hostel record with its own contact info and link to the selected owner
        const hostel = await this.adminRepository.createHostel({
            name: dto.name,
            type: dto.type,
            city: dto.city ?? null,
            address: dto.address ?? null,
            phone: dto.phone ?? null,
            email: dto.email ? (0, normalize_util_1.normalizeEmail)(dto.email) : null,
            ownerId: owner.id,
            createdByAdminId: adminId,
        });
        // 2. If logo is provided during creation, process & upload via imported upload logic.
        // NOTE: Logo failures used to be swallowed (console.warn) leaving logoUrl=null
        // silently — now the hostel is still created but `logoUploadError` is returned
        // so the frontend can show it and retry via POST /hostels/:id/logo.
        let logoUploadError = null;
        if (logoFile) {
            try {
                const uploadResult = await (0, hostel_logo_function_1.processHostelLogoUpload)(logoFile, hostel.id);
                hostel.logoUrl = uploadResult.url;
                hostel.logoPublicId = uploadResult.publicId;
                await this.adminRepository.saveHostel(hostel);
            }
            catch (err) {
                logoUploadError = err?.message || 'Logo upload failed';
                console.warn(`[AdminService] Logo upload failed during hostel creation: ${logoUploadError}`);
            }
        }
        // 3. Invalidate hostels list cache across all tiers (L1 & L2)
        await cache_util_1.cacheService.invalidatePattern('hostels');
        // 4. Dispatch event & Realtime live update
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.HOSTEL_UPDATED,
            payload: hostel,
        });
        // Notify hostel owner
        await notification_service_1.notificationService.createNotification({
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
        await notification_service_1.notificationService.notifyAdmins({
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
    async getAllHostels(page, limit) {
        const cacheKey = cache_util_1.cacheService.generateKey('hostels:list', { page, limit, v: 5 });
        // 3-Level Cache: L1 (In-Memory LRU) -> L2 (Redis Distributed) -> L3 (PostgreSQL DB)
        const { data, isCached, cacheLevel } = await cache_util_1.cacheService.wrap(cacheKey, async () => {
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
        }, {
            l1TtlSeconds: 30,
            l2TtlSeconds: 120,
            validateCached: async (cached) => {
                const value = cached;
                if (!Array.isArray(value.hostels) || typeof value.total !== 'number')
                    return false;
                try {
                    const [databaseTotal, existingPageItems] = await Promise.all([
                        this.adminRepository.countHostels(),
                        this.adminRepository.countExistingHostels(value.hostels.map((hostel) => hostel.id)),
                    ]);
                    return databaseTotal === value.total && existingPageItems === value.hostels.length;
                }
                catch {
                    // Preserve availability if PostgreSQL is temporarily unavailable.
                    return undefined;
                }
            },
        });
        return (0, pagination_util_1.createPaginatedResponse)(data.hostels, data.total, { page, limit }, { isCached, cacheLevel });
    }
    async invalidateHostelListCache() {
        await cache_util_1.cacheService.invalidatePattern('hostels');
    }
    /**
     * Assign or transfer a hostel to an Owner
     */
    async assignHostelOwner(hostelId, ownerId, adminId) {
        const [hostel, owner] = await Promise.all([
            this.adminRepository.findHostelById(hostelId),
            this.adminRepository.findUserById(ownerId),
        ]);
        if (!hostel) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
        }
        if (!owner || owner.role !== roles_enum_1.IROLES.OWNER) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'Owner user not found' } };
        }
        hostel.ownerId = owner.id;
        const savedHostel = await this.adminRepository.saveHostel(hostel);
        // Invalidate all tiers of hostel caches
        await cache_util_1.cacheService.invalidatePattern('hostels');
        // Dispatch realtime update to the assigned owner
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.HOSTEL_UPDATED,
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
    async suspendHostel(hostelId, adminId, reason) {
        const hostel = await this.adminRepository.findHostelById(hostelId);
        if (!hostel) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
        }
        hostel.isActive = false;
        hostel.suspendedAt = new Date();
        hostel.suspendReason = reason?.trim() ? reason.trim() : hostel.suspendReason;
        const savedHostel = await this.adminRepository.saveHostel(hostel);
        await this.invalidateHostelCaches();
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.HOSTEL_UPDATED,
            payload: savedHostel,
            hostelId: savedHostel.id,
            metadata: { adminId, action: 'SUSPEND', reason: savedHostel.suspendReason },
        });
        return { data: savedHostel };
    }
    /**
     * Reactivate a suspended hostel.
     */
    async reactivateHostel(hostelId, adminId) {
        const hostel = await this.adminRepository.findHostelById(hostelId);
        if (!hostel) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
        }
        hostel.isActive = true;
        hostel.suspendedAt = null;
        hostel.suspendReason = null;
        const savedHostel = await this.adminRepository.saveHostel(hostel);
        await this.invalidateHostelCaches();
        await event_dispatcher_util_1.eventDispatcher.dispatch({
            type: queue_constants_1.SocketEvent.HOSTEL_UPDATED,
            payload: savedHostel,
            hostelId: savedHostel.id,
            metadata: { adminId, action: 'REACTIVATE' },
        });
        return { data: savedHostel };
    }
    async invalidateHostelCaches() {
        // 'hostels' covers admin list/detail keys; 'public:hostels' + 'public:hostel'
        // cover public list/detail keys; 'hostel:leave-types' depends on hostel id.
        await cache_util_1.cacheService.invalidatePattern('hostels');
        await cache_util_1.cacheService.invalidatePattern('public:hostels');
        await cache_util_1.cacheService.invalidatePattern('public:hostel');
        await cache_util_1.cacheService.invalidatePattern('hostel:leave-types');
    }
    /**
     * Upload or replace a Hostel Logo via Cloudinary
     */
    async uploadHostelLogo(hostelId, file) {
        const hostel = await this.adminRepository.findHostelById(hostelId);
        if (!hostel) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Hostel not found' } };
        }
        // Process and upload logo using separate modular upload function
        const uploadResult = await (0, hostel_logo_function_1.processHostelLogoUpload)(file, hostelId, hostel.logoPublicId);
        hostel.logoUrl = uploadResult.url;
        hostel.logoPublicId = uploadResult.publicId;
        const savedHostel = await this.adminRepository.saveHostel(hostel);
        // Invalidate hostel caches across all tiers
        await cache_util_1.cacheService.invalidatePattern('hostels');
        return { data: savedHostel };
    }
}
exports.AdminService = AdminService;
// Named alias for backward compatibility
exports.AdminServices = AdminService;
