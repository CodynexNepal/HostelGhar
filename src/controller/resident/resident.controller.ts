// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident.controller.ts
// PURPOSE: Resident controller handling leave applications, leave histories,
//          fee queries, with Redis caching and real-time live updates.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { ApplyLeaveDto } from '../../dto/leave/apply-leave.dto';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { LeaveStatus } from '../../enum/leave.enum';
import { SocketEvent } from '../../constant/queue.constants';
import { ResidentRepository } from '../../repository/resident/resident.repository';

export class ResidentController {
  constructor(private readonly residentRepository: ResidentRepository) {}

  /**
   * Resident applies for a leave
   */
  public applyForLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const dto = req.body as ApplyLeaveDto;

      const resident = await this.residentRepository.findResidentByUserId(userId);

      if (!resident) {
        res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: 'Active resident record not found for your account',
        });
        return;
      }

      const savedLeave = await this.residentRepository.createLeaveRequest({
        residentId: resident.id,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason || null,
        status: LeaveStatus.PENDING,
      });

      // Invalidate resident's leave cache
      await cacheService.invalidatePattern(`resident:leaves:${resident.id}`);

      // Emit live real-time notification to hostel owner and room
      req.notifyHostel(resident.hostelId, SocketEvent.LEAVE_STATUS_CHANGED, {
        leaveId: savedLeave.id,
        residentId: resident.id,
        status: LeaveStatus.PENDING,
        startDate: dto.startDate,
        endDate: dto.endDate,
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
   * Get resident's leave history with caching & pagination
   */
  public getMyLeaves = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

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

      const { data, isCached } = await cacheService.wrap(
        cacheKey,
        async () => {
          const [leaves, total] = await this.residentRepository.findLeavesByResident(
            resident.id,
            page,
            limit,
          );

          return {
            leaves,
            pagination: {
              totalItems: total,
              currentPage: page,
              totalPages: Math.ceil(total / limit),
              itemsPerPage: limit,
              hasNextPage: page < Math.ceil(total / limit),
              hasPrevPage: page > 1,
            },
          };
        },
        60,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        isCached,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get resident fee bills and dues
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

      const { data, isCached } = await cacheService.wrap(
        cacheKey,
        async () => {
          const fees = await this.residentRepository.findFeesByResident(resident.id);

          const totalPendingDue = fees
            .filter((f) => f.status !== 'PAID')
            .reduce((sum, f) => sum + (Number(f.totalPayable) - Number(f.paidAmount)), 0);

          return { fees, totalPendingDue };
        },
        60,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        isCached,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const residentController = new ResidentController(new ResidentRepository());
