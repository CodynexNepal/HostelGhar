// ──────────────────────────────────────────────────────────────────────────────
// FILE: owner.controller.ts
// PURPOSE: Owner controller handling hostel dashboard, resident creation, leave types,
//          manual fee generation triggers, with Redis caching & isCached flag.
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

      const { data, isCached } = await cacheService.wrap(
        cacheKey,
        async () => {
          return await optimizedHostelQueryService.getOwnerHostelDashboard(ownerId);
        },
        60, // Cache for 60 seconds
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        isCached,
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

      // Invalidate caches
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

      // Invalidate cache
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
