// ──────────────────────────────────────────────────────────────────────────────
// FILE: admin.controller.ts
// PURPOSE: Admin HTTP Controller delegating entirely to AdminService.
//          Follows strict Controller -> Service -> Repository -> Database flow.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { CreateHostelDto } from '../../dto/hostel/create-hostel.dto';
import { AssignHostelOwnerDto } from '../../dto/admin/assign-hostel-owner.dto';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';
import { normalizePagination } from '../../utils/pagination.util';
import { pickHostelLogoFile } from '../../middleware/upload.middleware';
import { AdminService } from '../../services/admin/admin.services';
import { createHttpError } from '../../utils/createHttpError';
import { CreateOwnerDto } from '../../dto/admin/create-owner.dto';

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  public createOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const owner = await this.adminService.createOwner(req.body as CreateOwnerDto, req.file);
      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Owner created. Login credentials were queued for delivery by email.',
        data: { owner },
      });
    } catch (error) {
      next(error);
    }
  };

  public createHostel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = req.body as CreateHostelDto;
      const adminId = req.user!.userId;
      // Multer `.fields()` populates req.files (never req.file) — accept
      // the file under either the `logo` or `image` field name.
      const logoFile = pickHostelLogoFile(req);

      const result = await this.adminService.createHostel(adminId, dto, logoFile);

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAllHostels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });

      const paginatedResult = await this.adminService.getAllHostels(page, limit);

      res.status(STATUS_CODE.OK).json({
        success: true,
        ...paginatedResult,
      });
    } catch (error) {
      next(error);
    }
  };

  public invalidateHostelCache = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.adminService.invalidateHostelListCache();
      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Hostel list cache invalidated successfully',
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
      const adminId = req.user!.userId;

      const result = await this.adminService.assignHostelOwner(hostelId, dto.ownerId, adminId);

      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.UPDATED).json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  };

  public uploadLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      const logoFile = pickHostelLogoFile(req);
      if (!logoFile) {
        throw createHttpError(
          STATUS_CODE.BAD_REQUEST,
          'Logo file is required in field "logo" or "image"',
        );
      }

      const result = await this.adminService.uploadHostelLogo(hostelId, logoFile);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Hostel logo uploaded successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };
}
