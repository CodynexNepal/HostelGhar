"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: staff.service.ts (part 1/2 - core + create)
// PURPOSE: Hostel-scoped staff CRUD for Owner dashboard + Admin oversight.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffService = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const hostel_entity_1 = require("../../entities/hostel/hostel.entity");
const staff_enum_1 = require("../../enum/staff.enum");
const roles_enum_1 = require("../../enum/roles.enum");
const staff_repository_1 = require("../../repository/staff/staff.repository");
const createHttpError_1 = require("../../utils/createHttpError");
const cache_util_1 = require("../../utils/cache.util");
const pagination_util_1 = require("../../utils/pagination.util");
const cloudinary_util_1 = require("../../utils/cloudinary.util");
const database_source_1 = require("../../database/database-source");
class StaffService {
    constructor(staffRepository = new staff_repository_1.StaffRepository()) {
        this.staffRepository = staffRepository;
    }
    isAdmin(role) {
        return role.toLowerCase() === roles_enum_1.IROLES.ADMIN.toLowerCase();
    }
    async authorizeHostel(actorId, role, hostelId) {
        const hostel = await database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel).findOne({ where: { id: hostelId } });
        if (!hostel)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Hostel not found');
        if (!this.isAdmin(role) && hostel.ownerId !== actorId) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.FORBIDDEN, 'You do not manage this hostel');
        }
        return hostel;
    }
    async ownedHostelIds(ownerId) {
        const rows = await database_source_1.AppDataSource.getRepository(hostel_entity_1.Hostel).find({
            where: { ownerId },
            select: { id: true },
        });
        return rows.map((hostel) => hostel.id);
    }
    toNullable(value) {
        if (value === undefined || value === null)
            return null;
        const trimmed = String(value).trim();
        return trimmed === '' ? null : trimmed;
    }
    toSalary(value) {
        if (value === undefined || value === null || value === '')
            return null;
        const num = Number(value);
        if (Number.isNaN(num))
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Monthly salary must be a number');
        if (num <= 0)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Monthly salary must be positive');
        return Math.round(num * 100) / 100;
    }
    async create(actorId, role, dto, file) {
        if (!dto.hostelId)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'hostelId is required');
        await this.authorizeHostel(actorId, role, dto.hostelId);
        const staff = this.staffRepository.create({
            hostelId: dto.hostelId,
            fullName: dto.fullName.trim(),
            phone: dto.phone.trim(),
            role: dto.role,
            shift: dto.shift ?? staff_enum_1.StaffShift.DAY,
            status: dto.status ?? staff_enum_1.StaffStatus.ACTIVE,
            email: this.toNullable(dto.email),
            monthlySalary: this.toSalary(dto.monthlySalary),
            emergencyContact: this.toNullable(dto.emergencyContact),
            createdById: actorId,
        });
        const saved = await this.staffRepository.save(staff);
        if (file?.buffer) {
            const upload = await cloudinary_util_1.CloudinaryUtil.uploadBuffer(file.buffer, {
                folder: 'hostelghar/staff/photos',
                public_id: `staff_${saved.id}_${Date.now()}`,
                overwrite: true,
                transformation: [
                    { width: 500, height: 500, crop: 'thumb', gravity: 'face' },
                    { quality: 'auto:good', fetch_format: 'webp' },
                ],
                tags: ['staff_photo', `hostel_${saved.hostelId}`],
            });
            saved.photoUrl = upload.secureUrl;
            saved.photoPublicId = upload.publicId;
            const withPhoto = await this.staffRepository.save(saved);
            await this.invalidateStaffCaches(withPhoto.id, withPhoto.hostelId);
            return withPhoto;
        }
        await this.invalidateStaffCaches(saved.id, saved.hostelId);
        return saved;
    }
    async invalidateStaffCaches(staffId, hostelId) {
        const tasks = [
            cache_util_1.cacheService.invalidatePattern('staff:list'),
            cache_util_1.cacheService.invalidatePattern('staff:hostel'),
        ];
        if (staffId) {
            tasks.push(cache_util_1.cacheService.invalidate(cache_util_1.cacheService.generateKey('staff:detail', { id: staffId })));
        }
        if (hostelId) {
            tasks.push(cache_util_1.cacheService.invalidatePattern('owner:dashboard'));
            tasks.push(cache_util_1.cacheService.invalidatePattern('analytics:owner'));
        }
        await Promise.all(tasks);
    }
    async list(actorId, role, options) {
        const admin = this.isAdmin(role);
        if (options.hostelId) {
            await this.authorizeHostel(actorId, role, options.hostelId);
            const filters = {
                hostelId: options.hostelId,
                role: options.role,
                shift: options.shift,
                status: options.status,
                search: options.search,
            };
            const cacheKey = cache_util_1.cacheService.generateKey('staff:hostel', {
                hostelId: options.hostelId,
                role: filters.role ?? 'ALL',
                shift: filters.shift ?? 'ALL',
                status: filters.status ?? 'ALL',
                search: filters.search ?? '',
                page: options.page,
                limit: options.limit,
            });
            const wrapped = await cache_util_1.cacheService.wrap(cacheKey, async () => {
                const [staff, total] = await this.staffRepository.findPage(filters, options.page, options.limit);
                return { staff, total };
            }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
            return (0, pagination_util_1.createPaginatedResponse)(wrapped.data.staff, wrapped.data.total, options, {
                isCached: wrapped.isCached,
                cacheLevel: wrapped.cacheLevel,
            });
        }
        const cacheKey = cache_util_1.cacheService.generateKey('staff:list', {
            scope: admin ? 'admin' : 'owner',
            actorId,
            role: options.role ?? 'ALL',
            shift: options.shift ?? 'ALL',
            status: options.status ?? 'ALL',
            search: options.search ?? '',
            page: options.page,
            limit: options.limit,
        });
        const wrapped = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            if (admin) {
                const [staff, total] = await this.staffRepository.findPage({
                    role: options.role,
                    shift: options.shift,
                    status: options.status,
                    search: options.search,
                }, options.page, options.limit);
                return { staff, total };
            }
            const hostelIds = await this.ownedHostelIds(actorId);
            if (!hostelIds.length)
                return { staff: [], total: 0 };
            const [staff, total] = await this.staffRepository.findPage({
                hostelIds,
                role: options.role,
                shift: options.shift,
                status: options.status,
                search: options.search,
            }, options.page, options.limit);
            return { staff, total };
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return (0, pagination_util_1.createPaginatedResponse)(wrapped.data.staff, wrapped.data.total, options, {
            isCached: wrapped.isCached,
            cacheLevel: wrapped.cacheLevel,
        });
    }
    async getById(actorId, role, id) {
        const staff = await this.staffRepository.findById(id);
        if (!staff)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Staff member not found');
        await this.authorizeHostel(actorId, role, staff.hostelId);
        return staff;
    }
    async update(actorId, role, id, dto, file) {
        const staff = await this.getById(actorId, role, id);
        if (dto.fullName !== undefined)
            staff.fullName = dto.fullName.trim();
        if (dto.phone !== undefined)
            staff.phone = dto.phone.trim();
        if (dto.role !== undefined)
            staff.role = dto.role;
        if (dto.shift !== undefined)
            staff.shift = dto.shift;
        if (dto.status !== undefined)
            staff.status = dto.status;
        if (dto.email !== undefined)
            staff.email = this.toNullable(dto.email);
        if (dto.monthlySalary !== undefined)
            staff.monthlySalary = this.toSalary(dto.monthlySalary);
        if (dto.emergencyContact !== undefined)
            staff.emergencyContact = this.toNullable(dto.emergencyContact);
        if (file?.buffer) {
            if (staff.photoPublicId) {
                cloudinary_util_1.CloudinaryUtil.deleteByPublicId(staff.photoPublicId).catch((err) => console.warn('[StaffService] Could not delete old staff photo:', err));
            }
            const upload = await cloudinary_util_1.CloudinaryUtil.uploadBuffer(file.buffer, {
                folder: 'hostelghar/staff/photos',
                public_id: `staff_${staff.id}_${Date.now()}`,
                overwrite: true,
                transformation: [
                    { width: 500, height: 500, crop: 'thumb', gravity: 'face' },
                    { quality: 'auto:good', fetch_format: 'webp' },
                ],
                tags: ['staff_photo', `hostel_${staff.hostelId}`],
            });
            staff.photoUrl = upload.secureUrl;
            staff.photoPublicId = upload.publicId;
        }
        const saved = await this.staffRepository.save(staff);
        await this.invalidateStaffCaches(saved.id, saved.hostelId);
        return saved;
    }
    async remove(actorId, role, id) {
        const staff = await this.getById(actorId, role, id);
        if (staff.photoPublicId) {
            cloudinary_util_1.CloudinaryUtil.deleteByPublicId(staff.photoPublicId).catch((err) => console.warn('[StaffService] Could not delete staff photo:', err));
        }
        await this.staffRepository.remove(staff);
        await this.invalidateStaffCaches(id, staff.hostelId);
    }
}
exports.StaffService = StaffService;
