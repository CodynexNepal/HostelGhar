// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.controller.ts
// PURPOSE: Admin controller managing hostel creations, assignments, and caching.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { CreateHostelDto } from '../../dto/hostel/create-hostel.dto';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { SocketEvent } from '../../constant/queue.constants';
import { AdminRepository } from '../../repository/admin/admin.repository';
import { AssignHostelOwnerDto } from '../../dto/admin/assign-hostel-owner.dto';
import { IROLES } from '../../enum/roles.enum';
import { getRequiredParam } from '../../decorators/http.decorator';

export class AdminController {
  constructor(private readonly adminRepository: AdminRepository) {}

  public createHostel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = req.body as CreateHostelDto;
      const adminId = req.user!.userId;

      const savedHostel = await this.adminRepository.createHostel({
        name: dto.name,
        type: dto.type,
        ownerId: dto.ownerId || null,
        createdByAdminId: adminId,
      });

      // Invalidate hostels list cache
      await cacheService.invalidatePattern('hostels');

      // Dispatch event & Realtime live update
      await eventDispatcher.dispatch({
        type: SocketEvent.HOSTEL_UPDATED,
        payload: savedHostel,
      });

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Hostel created successfully',
        data: savedHostel,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAllHostels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
      const cacheKey = cacheService.generateKey('hostels:list', { page, limit });

      const { data, isCached } = await cacheService.wrap(
        cacheKey,
        async () => {
          const [hostels, total] = await this.adminRepository.findHostelsWithPagination(
            page,
            limit,
          );

          return {
            hostels,
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
        120, // Cache for 2 minutes
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

  public assignHostelOwner = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      const dto = req.body as AssignHostelOwnerDto;
      const [hostel, owner] = await Promise.all([
        this.adminRepository.findHostelById(hostelId),
        this.adminRepository.findUserById(dto.ownerId),
      ]);

      if (!hostel) {
        res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: 'Hostel not found' });
        return;
      }

      if (!owner || owner.role !== IROLES.OWNER) {
        res
          .status(STATUS_CODE.BAD_REQUEST)
          .json({ success: false, message: 'Owner user not found' });
        return;
      }

      hostel.ownerId = owner.id;
      const savedHostel = await this.adminRepository.saveHostel(hostel);
      await cacheService.invalidatePattern('hostels');
      await eventDispatcher.dispatch({
        type: SocketEvent.HOSTEL_UPDATED,
        payload: savedHostel,
        userId: owner.id,
        metadata: { adminId: req.user!.userId },
      });

      res.status(STATUS_CODE.UPDATED).json({ success: true, data: savedHostel });
    } catch (error) {
      next(error);
    }
  };
}

export const adminController = new AdminController(new AdminRepository());
