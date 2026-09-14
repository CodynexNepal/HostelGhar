// ──────────────────────────────────────────────────────────────────────────────
// FILE: owner.controller.ts
// PURPOSE: Owner controller handling hostel dashboard, resident creation, leave types,
//          manual fee generation triggers, with 3-tier caching & Cloudinary media upload.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { CreateResidentDto } from '../../dto/resident/create-resident.dto';
import { CreateLeaveTypeDto } from '../../dto/leave/create-leave-type.dto';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { IROLES } from '../../enum/roles.enum';

import { PasswordHasher } from '../../utils/password-hasher.util';
import { cacheService } from '../../utils/cache.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { JobType, SocketEvent } from '../../constant/queue.constants';
import { feeService } from '../../services/fee/fee.service';
import { optimizedHostelQueryService } from '../../services/hostel/hostel-query.service';
import { OwnerRepository } from '../../repository/owner/owner.repository';
import { getRequiredParam } from '../../decorators/http.decorator';
import { imageUploadService } from '../../services/upload/image-upload.service';
import { createHttpError } from '../../utils/createHttpError';

export class OwnerController {
  constructor(private readonly ownerRepository: OwnerRepository) {}

  /**
   * Get all hostels managed by the owner with aggregated resident counts
   */
  public getMyHostelsDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const cacheKey = cacheService.generateKey('owner:dashboard', ownerId);

      // 3-Level Caching: L1 Memory LRU -> L2 Redis -> L3 Database Loader
      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () => {
          return await optimizedHostelQueryService.getOwnerHostelDashboard(ownerId);
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 60 },
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        isCached,
        cacheLevel,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a resident account and assign them to a hostel room
   */
  public createResident = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as CreateResidentDto;
      const ownerId = req.user!.userId;

      // Verify that this hostel is owned by this owner
      const hostel = await this.ownerRepository.findHostelByIdAndOwner(dto.hostelId, ownerId);

      if (!hostel) {
        res.status(STATUS_CODE.FORBIDDEN).json({
          success: false,
          message: 'You do not have permission to add residents to this hostel',
        });
        return;
      }

      // Check if user already exists
      let user = await this.ownerRepository.findUserByEmail(dto.email);
      const tempPassword = dto.password || 'Hostel@123';

      if (!user) {
        const hashedPassword = await PasswordHasher.hash(tempPassword);
        user = await this.ownerRepository.createUser({
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          password: hashedPassword,
          role: IROLES.RESIDENT,
        });
      }

      // Create resident profile
      const savedResident = await this.ownerRepository.createResident({
        userId: user.id,
        hostelId: dto.hostelId,
        roomNumber: dto.roomNumber,
        isActive: true,
      });

      // Invalidate caches across all tiers
      await cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);
      await cacheService.invalidatePattern(`hostel:residents:${dto.hostelId}`);

      // Dispatch welcome email via BullMQ
      await eventDispatcher.queueEmail(JobType.SEND_WELCOME_EMAIL, {
        to: user.email,
        subject: `Welcome to ${hostel.name}`,
        body: `Hello ${user.firstName}, you have been added to ${hostel.name} in Room ${dto.roomNumber}. Your temporary password is: ${tempPassword}`,
      });

      // Emit live real-time notification
      req.notifyHostel(hostel.id, SocketEvent.USER_STATUS_CHANGED, {
        residentId: savedResident.id,
        name: `${user.firstName} ${user.lastName}`,
        room: dto.roomNumber,
      });

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Resident created and assigned to hostel successfully',
        data: savedResident,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload or replace Hostel Logo (Owner restricted to own hostel)
   */
  public uploadHostelLogo = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      const ownerId = req.user!.userId;

      const hostel = await this.ownerRepository.findHostelByIdAndOwner(hostelId, ownerId);
      if (!hostel) {
        throw createHttpError(STATUS_CODE.FORBIDDEN, 'Hostel not found or not owned by you');
      }

      if (!req.file) {
        throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Logo file is required in field "logo"');
      }

      const uploadResult = await imageUploadService.uploadHostelLogo(
        req.file,
        hostel.id,
        hostel.logoPublicId,
      );

      hostel.logoUrl = uploadResult.url;
      hostel.logoPublicId = uploadResult.publicId;
      const savedHostel = await this.ownerRepository.saveHostel(hostel);

      await cacheService.invalidatePattern('hostels');
      await cacheService.invalidatePattern(`owner:dashboard:${ownerId}`);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Hostel logo uploaded successfully',
        data: savedHostel,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload or replace Student / Resident Photo (with face-center cropping)
   */
  public uploadResidentPhoto = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const residentId = getRequiredParam(req, 'id');
      const ownerId = req.user!.userId;

      const resident = await this.ownerRepository.findResidentByIdAndOwner(residentId, ownerId);
      if (!resident) {
        throw createHttpError(
          STATUS_CODE.FORBIDDEN,
          'Resident not found or does not belong to your hostel',
        );
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
      const savedResident = await this.ownerRepository.saveResident(resident);

      await cacheService.invalidatePattern(`hostel:residents:${resident.hostelId}`);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Student photo uploaded successfully',
        data: savedResident,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload or replace Student / Resident Identification Document
   */
  public uploadResidentDocument = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const residentId = getRequiredParam(req, 'id');
      const ownerId = req.user!.userId;

      const resident = await this.ownerRepository.findResidentByIdAndOwner(residentId, ownerId);
      if (!resident) {
        throw createHttpError(
          STATUS_CODE.FORBIDDEN,
          'Resident not found or does not belong to your hostel',
        );
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
      const savedResident = await this.ownerRepository.saveResident(resident);

      await cacheService.invalidatePattern(`hostel:residents:${resident.hostelId}`);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Student document uploaded successfully',
        data: savedResident,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a leave type policy for a hostel
   */
  public createLeaveType = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as CreateLeaveTypeDto;
      const ownerId = req.user!.userId;

      // Verify hostel ownership
      const hostel = await this.ownerRepository.findHostelByIdAndOwner(dto.hostelId, ownerId);

      if (!hostel) {
        res.status(STATUS_CODE.FORBIDDEN).json({
          success: false,
          message: 'You can only configure leave policies for your own hostels',
        });
        return;
      }

      const savedLeaveType = await this.ownerRepository.createLeaveType({
        hostelId: dto.hostelId,
        name: dto.name,
        maxDays: dto.maxDays || 7,
        requiresParentApproval: dto.requiresParentApproval || false,
      });

      // Invalidate cache across all tiers
      await cacheService.invalidatePattern(`leave:types:${dto.hostelId}`);

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Leave type policy created successfully',
        data: savedLeaveType,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Trigger monthly fee batch generation manually
   */
  public triggerMonthlyFees = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await feeService.generateMonthlyFeesForAllHostels();
      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Monthly fees generated and dispatched to residents',
        result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const ownerController = new OwnerController(new OwnerRepository());
