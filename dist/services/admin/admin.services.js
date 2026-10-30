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
const email_template_1 = require("../../templates/email.template");
const queue_constants_2 = require("../../constant/queue.constants");
const smtp_config_1 = require("../../configs/smtp.config");
const crypto_1 = __importDefault(require("crypto"));
const createHttpError_1 = require("../../utils/createHttpError");
const image_upload_service_1 = require("../../services/upload/image-upload.service");
const notification_service_1 = require("../notification/notification.service");
class AdminService {
    constructor(adminRepository, userRepository) {
        this.adminRepository = adminRepository;
        this.userRepository = userRepository;
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
        };
    }
    /**
     * Create a new hostel with optional logo upload in a single transaction-like step
     */
    async createHostel(adminId, dto, logoFile) {
        const hostelEmail = dto.email ? (0, normalize_util_1.normalizeEmail)(dto.email) : null;
        if (!hostelEmail) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Hostel email is required and must match the owner email');
        }
        const owner = await this.userRepository.findOwnerByEmail(hostelEmail);
        if (!owner) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Create an owner with this email before creating the hostel');
        }
        if (dto.ownerId && dto.ownerId !== owner.id) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Owner ID does not match the hostel email');
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
