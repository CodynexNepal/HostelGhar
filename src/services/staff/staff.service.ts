// ──────────────────────────────────────────────────────────────────────────────
// FILE: staff.service.ts (part 1/2 - core + create)
// PURPOSE: Hostel-scoped staff CRUD for Owner dashboard + Admin oversight.
// ──────────────────────────────────────────────────────────────────────────────

import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CreateStaffDto } from '../../dto/staff/create-staff.dto';
import { UpdateStaffDto } from '../../dto/staff/update-staff.dto';
import { Staff } from '../../entities/staff/staff.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { StaffRole, StaffShift, StaffStatus } from '../../enum/staff.enum';
import { IROLES } from '../../enum/roles.enum';
import { StaffFilters, StaffRepository } from '../../repository/staff/staff.repository';
import { createHttpError } from '../../utils/createHttpError';
import { cacheService } from '../../utils/cache.util';
import { createPaginatedResponse, PaginatedResponse } from '../../utils/pagination.util';
import { CloudinaryUtil } from '../../utils/cloudinary.util';
import { AppDataSource } from '../../database/database-source';

export interface StaffListOptions {
  page: number;
  limit: number;
  hostelId?: string | undefined;
  role?: StaffRole | undefined;
  shift?: StaffShift | undefined;
  status?: StaffStatus | undefined;
  search?: string | undefined;
}

export class StaffService {
  constructor(private readonly staffRepository = new StaffRepository()) {}

  protected isAdmin(role: string): boolean {
    return role.toLowerCase() === IROLES.ADMIN.toLowerCase();
  }

  protected async authorizeHostel(
    actorId: string,
    role: string,
    hostelId: string,
  ): Promise<Hostel> {
    const hostel = await AppDataSource.getRepository(Hostel).findOne({ where: { id: hostelId } });
    if (!hostel) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Hostel not found');
    if (!this.isAdmin(role) && hostel.ownerId !== actorId) {
      throw createHttpError(STATUS_CODE.FORBIDDEN, 'You do not manage this hostel');
    }
    return hostel;
  }

  protected async ownedHostelIds(ownerId: string): Promise<string[]> {
    const rows = await AppDataSource.getRepository(Hostel).find({
      where: { ownerId },
      select: { id: true },
    });
    return rows.map((hostel) => hostel.id);
  }

  protected toNullable(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
  }

  protected toSalary(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num))
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Monthly salary must be a number');
    if (num <= 0) throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Monthly salary must be positive');
    return Math.round(num * 100) / 100;
  }

  public async create(
    actorId: string,
    role: string,
    dto: CreateStaffDto,
    file?: Express.Multer.File,
  ): Promise<Staff> {
    if (!dto.hostelId) throw createHttpError(STATUS_CODE.BAD_REQUEST, 'hostelId is required');
    await this.authorizeHostel(actorId, role, dto.hostelId);

    const staff = this.staffRepository.create({
      hostelId: dto.hostelId,
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      role: dto.role,
      shift: dto.shift ?? StaffShift.DAY,
      status: dto.status ?? StaffStatus.ACTIVE,
      email: this.toNullable(dto.email),
      monthlySalary: this.toSalary(dto.monthlySalary),
      emergencyContact: this.toNullable(dto.emergencyContact),
      createdById: actorId,
    });
    const saved = await this.staffRepository.save(staff);

    if (file?.buffer) {
      const upload = await CloudinaryUtil.uploadBuffer(file.buffer, {
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

  protected async invalidateStaffCaches(staffId?: string, hostelId?: string): Promise<void> {
    const tasks: Promise<void>[] = [
      cacheService.invalidatePattern('staff:list'),
      cacheService.invalidatePattern('staff:hostel'),
    ];
    if (staffId) {
      tasks.push(
        cacheService.invalidate(cacheService.generateKey('staff:detail', { id: staffId })),
      );
    }
    if (hostelId) {
      tasks.push(cacheService.invalidatePattern('owner:dashboard'));
      tasks.push(cacheService.invalidatePattern('analytics:owner'));
    }
    await Promise.all(tasks);
  }

  public async list(
    actorId: string,
    role: string,
    options: StaffListOptions,
  ): Promise<PaginatedResponse<Staff>> {
    const admin = this.isAdmin(role);
    if (options.hostelId) {
      await this.authorizeHostel(actorId, role, options.hostelId);
      const filters: StaffFilters = {
        hostelId: options.hostelId,
        role: options.role,
        shift: options.shift,
        status: options.status,
        search: options.search,
      };
      const cacheKey = cacheService.generateKey('staff:hostel', {
        hostelId: options.hostelId,
        role: filters.role ?? 'ALL',
        shift: filters.shift ?? 'ALL',
        status: filters.status ?? 'ALL',
        search: filters.search ?? '',
        page: options.page,
        limit: options.limit,
      });
      const wrapped = await cacheService.wrap(
        cacheKey,
        async () => {
          const [staff, total] = await this.staffRepository.findPage(
            filters,
            options.page,
            options.limit,
          );
          return { staff, total };
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );
      return createPaginatedResponse(wrapped.data.staff, wrapped.data.total, options, {
        isCached: wrapped.isCached,
        cacheLevel: wrapped.cacheLevel,
      });
    }
    const cacheKey = cacheService.generateKey('staff:list', {
      scope: admin ? 'admin' : 'owner',
      actorId,
      role: options.role ?? 'ALL',
      shift: options.shift ?? 'ALL',
      status: options.status ?? 'ALL',
      search: options.search ?? '',
      page: options.page,
      limit: options.limit,
    });
    const wrapped = await cacheService.wrap(
      cacheKey,
      async () => {
        if (admin) {
          const [staff, total] = await this.staffRepository.findPage(
            {
              role: options.role,
              shift: options.shift,
              status: options.status,
              search: options.search,
            },
            options.page,
            options.limit,
          );
          return { staff, total };
        }
        const hostelIds = await this.ownedHostelIds(actorId);
        if (!hostelIds.length) return { staff: [] as Staff[], total: 0 };
        const [staff, total] = await this.staffRepository.findPage(
          {
            hostelIds,
            role: options.role,
            shift: options.shift,
            status: options.status,
            search: options.search,
          },
          options.page,
          options.limit,
        );
        return { staff, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );
    return createPaginatedResponse(wrapped.data.staff, wrapped.data.total, options, {
      isCached: wrapped.isCached,
      cacheLevel: wrapped.cacheLevel,
    });
  }

  public async getById(actorId: string, role: string, id: string): Promise<Staff> {
    const staff = await this.staffRepository.findById(id);
    if (!staff) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Staff member not found');
    await this.authorizeHostel(actorId, role, staff.hostelId);
    return staff;
  }

  public async update(
    actorId: string,
    role: string,
    id: string,
    dto: UpdateStaffDto,
    file?: Express.Multer.File,
  ): Promise<Staff> {
    const staff = await this.getById(actorId, role, id);
    if (dto.fullName !== undefined) staff.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) staff.phone = dto.phone.trim();
    if (dto.role !== undefined) staff.role = dto.role;
    if (dto.shift !== undefined) staff.shift = dto.shift;
    if (dto.status !== undefined) staff.status = dto.status;
    if (dto.email !== undefined) staff.email = this.toNullable(dto.email);
    if (dto.monthlySalary !== undefined) staff.monthlySalary = this.toSalary(dto.monthlySalary);
    if (dto.emergencyContact !== undefined)
      staff.emergencyContact = this.toNullable(dto.emergencyContact);
    if (file?.buffer) {
      if (staff.photoPublicId) {
        CloudinaryUtil.deleteByPublicId(staff.photoPublicId).catch((err) =>
          console.warn('[StaffService] Could not delete old staff photo:', err),
        );
      }
      const upload = await CloudinaryUtil.uploadBuffer(file.buffer, {
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

  public async remove(actorId: string, role: string, id: string): Promise<void> {
    const staff = await this.getById(actorId, role, id);
    if (staff.photoPublicId) {
      CloudinaryUtil.deleteByPublicId(staff.photoPublicId).catch((err) =>
        console.warn('[StaffService] Could not delete staff photo:', err),
      );
    }
    await this.staffRepository.remove(staff);
    await this.invalidateStaffCaches(id, staff.hostelId);
  }
}
