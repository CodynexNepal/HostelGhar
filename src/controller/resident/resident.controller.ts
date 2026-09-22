// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident.controller.ts
// PURPOSE: Resident controller handling leave applications, leave histories,
//          fee queries, with 3-tier caching, real-time updates, and Cloudinary upload.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { ApplyLeaveDto } from '../../dto/leave/apply-leave.dto';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { LeaveStatus } from '../../enum/leave.enum';
import { SocketEvent } from '../../constant/queue.constants';
import { ResidentRepository } from '../../repository/resident/resident.repository';
import { normalizePagination, createPaginatedResponse } from '../../utils/pagination.util';
import { imageUploadService } from '../../services/upload/image-upload.service';
import { createHttpError } from '../../utils/createHttpError';

export class ResidentController {
  constructor(private readonly residentRepository: ResidentRepository) {}

  /**
   * Resident applies for a leave
   */
  public applyForLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const dto = req.body as ApplyLeaveDto;

      // Accept BOTH frontend namings: startDate/endDate/reason (canonical)
      // and fromDate/toDate/remarks (legacy UI). Canonical wins if both sent.
      const startDate = dto.startDate?.trim() || dto.fromDate?.trim() || '';
      const endDate = dto.endDate?.trim() || dto.toDate?.trim() || '';
      const reason = dto.reason?.trim() || dto.remarks?.trim() || null;

      if (!startDate || !endDate) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message:
            'Start date and end date are required. Send { startDate, endDate } or { fromDate, toDate } as YYYY-MM-DD.',
        });
        return;
      }

      // Strict YYYY-MM-DD (not full ISO datetime) to match `date` columns.
      const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
      if (!DATE_ONLY.test(startDate) || !DATE_ONLY.test(endDate)) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'Start date and end date must be valid ISO date strings (YYYY-MM-DD).',
        });
        return;
      }
      if (endDate < startDate) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'End date must be on or after start date.',
        });
        return;
      }

      const resident = await this.residentRepository.findResidentByUserId(userId);

      if (!resident) {
        res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: 'Active resident record not found for your account',
        });
        return;
      }

      // Leave type must exist AND belong to the resident's own hostel.
      const leaveType = await this.residentRepository.findLeaveTypeById(dto.leaveTypeId);
      if (!leaveType || leaveType.hostelId !== resident.hostelId) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message:
            'Invalid leave type for your hostel. Pick leaveTypeId from GET /hostels/:id/leave-types using your own hostelId.',
        });
        return;
      }

      const savedLeave = await this.residentRepository.createLeaveRequest({
        residentId: resident.id,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        reason,
        status: LeaveStatus.PENDING,
      });

      // Invalidate resident's leave cache across all cache tiers
      await cacheService.invalidatePattern(`resident:leaves:${resident.id}`);
      await cacheService.invalidatePattern(`hostel:leaves:${resident.hostelId}`);

      // Emit live real-time notification to hostel owner and room
      req.notifyHostel(resident.hostelId, SocketEvent.LEAVE_STATUS_CHANGED, {
        leaveId: savedLeave.id,
        residentId: resident.id,
        status: LeaveStatus.PENDING,
        startDate,
        endDate,
      });

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Leave application submitted successfully',
        data: savedLeave,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /resident/me — dashboard bootstrap for the logged-in resident.
   * Returns resident profile + hostel + assigned room (matched by
   * hostelId+roomNumber) + roommates count, so the frontend NEVER calls
   * owner/admin-only routes like GET /hostels/:id/residents or GET /rooms.
   */
  public getMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;

      const resident = await this.residentRepository.findResidentByUserId(userId);
      if (!resident) {
        res
          .status(STATUS_CODE.NOT_FOUND)
          .json({ success: false, message: 'Resident profile not found' });
        return;
      }

      const cacheKey = cacheService.generateKey('resident:profile', resident.id);
      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () => {
          const room = await this.residentRepository.findRoomForResident(
            resident.hostelId,
            resident.roomNumber,
          );
          const facilities = await this.residentRepository.findFacilitiesByHostel(
            resident.hostelId,
          );
          return {
            room: room
              ? {
                  id: room.id,
                  roomNumber: room.roomNumber,
                  type: room.type,
                  capacity: room.capacity,
                  occupied: room.occupied,
                  monthlyRent: Number(room.monthlyRent),
                  floor: room.floor,
                  flat: room.floor,
                  status: room.status,
                  amenities: room.amenities ?? [],
                  imageUrl: room.imageUrl,
                }
              : null,
            facilities: facilities.map((hf) => ({
              id: hf.id,
              title: hf.facility?.title ?? null,
              slug: hf.facility?.slug ?? null,
              description: hf.description,
              tag: hf.tag,
            })),
          };
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );

      const firstName = resident.user?.firstName ?? '';
      const lastName = resident.user?.lastName ?? '';

      res.status(STATUS_CODE.OK).json({
        success: true,
        isCached,
        cacheLevel,
        data: {
          id: resident.id,
          fullName: `${firstName} ${lastName}`.trim(),
          firstName,
          lastName,
          email: resident.user?.email ?? null,
          phone: resident.user?.phone ?? null,
          photoUrl: resident.photoUrl ?? resident.user?.avatarUrl ?? null,
          roomNumber: resident.roomNumber ?? null,
          bedNumber: resident.bedNumber ?? null,
          monthlyRent: resident.monthlyRent != null ? Number(resident.monthlyRent) : null,
          joinedDate: resident.createdAt ?? null,
          hostel: resident.hostel
            ? {
                id: resident.hostel.id,
                name: resident.hostel.name,
                type: resident.hostel.type ?? null,
                city: resident.hostel.city ?? null,
                address: resident.hostel.address ?? null,
              }
            : { id: resident.hostelId, name: null, type: null, city: null, address: null },
          room: data.room,
          facilities: data.facilities,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get resident's leave history with 3-tier caching & pagination
   */
  public getMyLeaves = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });

      const resident = await this.residentRepository.findResidentByUserId(userId);
      if (!resident) {
        res
          .status(STATUS_CODE.NOT_FOUND)
          .json({ success: false, message: 'Resident profile not found' });
        return;
      }

      const cacheKey = cacheService.generateKey('resident:leaves', {
        residentId: resident.id,
        page,
        limit,
      });

      // 3-tier cache: L1 Memory LRU -> L2 Redis -> L3 DB
      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () => {
          const [leaves, total] = await this.residentRepository.findLeavesByResident(
            resident.id,
            page,
            limit,
          );
          return { leaves, total };
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );

      const paginated = createPaginatedResponse(
        data.leaves,
        data.total,
        { page, limit },
        { isCached, cacheLevel },
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        ...paginated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get resident fee bills and dues with 3-tier caching
   */
  public getMyFees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const resident = await this.residentRepository.findResidentByUserId(userId);

      if (!resident) {
        res
          .status(STATUS_CODE.NOT_FOUND)
          .json({ success: false, message: 'Resident profile not found' });
        return;
      }

      const cacheKey = cacheService.generateKey('resident:fees', resident.id);

      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () => {
          const fees = await this.residentRepository.findFeesByResident(resident.id);

          const totalPendingDue = fees
            .filter((f) => f.status !== 'PAID')
            .reduce((sum, f) => sum + (Number(f.totalPayable) - Number(f.paidAmount)), 0);

          return { fees, totalPendingDue };
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        isCached,
        cacheLevel,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload or update own student profile photo (with face centering)
   */
  public uploadMyPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const resident = await this.residentRepository.findResidentByUserId(userId);

      if (!resident) {
        throw createHttpError(STATUS_CODE.NOT_FOUND, 'Resident profile not found');
      }

      if (!req.file) {
        throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Photo file is required in field "photo"');
      }

      const uploadResult = await imageUploadService.uploadStudentPhoto(
        req.file,
        resident.id,
        resident.photoPublicId,
      );

      resident.photoUrl = uploadResult.url;
      resident.photoPublicId = uploadResult.publicId;
      const savedResident = await this.residentRepository.saveResident(resident);

      await cacheService.invalidatePattern(`hostel:residents`);
      await cacheService.invalidatePattern(`owner:residents`);
      await cacheService.invalidatePattern(`resident:profile`);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Student profile photo uploaded successfully',
        data: savedResident,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload or update own identification document
   */
  public uploadMyDocument = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const resident = await this.residentRepository.findResidentByUserId(userId);

      if (!resident) {
        throw createHttpError(STATUS_CODE.NOT_FOUND, 'Resident profile not found');
      }

      if (!req.file) {
        throw createHttpError(
          STATUS_CODE.BAD_REQUEST,
          'Document file is required in field "document"',
        );
      }

      const uploadResult = await imageUploadService.uploadStudentDocument(
        req.file,
        resident.id,
        resident.documentPublicId,
      );

      resident.documentUrl = uploadResult.url;
      resident.documentPublicId = uploadResult.publicId;
      const savedResident = await this.residentRepository.saveResident(resident);

      await cacheService.invalidatePattern(`hostel:residents`);
      await cacheService.invalidatePattern(`owner:residents`);
      await cacheService.invalidatePattern(`resident:profile`);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Student document uploaded successfully',
        data: savedResident,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const residentController = new ResidentController(new ResidentRepository());
