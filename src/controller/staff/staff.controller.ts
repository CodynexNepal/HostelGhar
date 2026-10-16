import { NextFunction, Request, Response } from 'express';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CreateStaffDto } from '../../dto/staff/create-staff.dto';
import { UpdateStaffDto } from '../../dto/staff/update-staff.dto';
import { StaffRole, StaffShift, StaffStatus } from '../../enum/staff.enum';
import { getRequiredParam } from '../../decorators/http.decorator';
import { normalizePagination } from '../../utils/pagination.util';
import { StaffService } from '../../services/staff/staff.service';
import { createHttpError } from '../../utils/createHttpError';
import { pickStaffPhotoFile } from '../../middleware/upload.middleware';

export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  /**
   * POST /staff — Owner/Admin creates a staff member for a hostel.
   * Accepts JSON or multipart/form-data (photo under `photo` field, ≤5MB).
   * hostelId may come from body, ?hostelId= or X-Hostel-Id header.
   */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Partial<CreateStaffDto>;
      if (!body.hostelId) {
        const fromQuery = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
        const fromHeader =
          typeof req.headers['x-hostel-id'] === 'string' ? req.headers['x-hostel-id'] : undefined;
        const resolved = fromQuery ?? fromHeader;
        if (resolved) (req.body as Record<string, unknown>).hostelId = resolved;
      }
      const file = pickStaffPhotoFile(req);
      const data = await this.staffService.create(
        req.user!.userId,
        req.user!.role,
        req.body as CreateStaffDto,
        file,
      );
      res
        .status(STATUS_CODE.CREATED)
        .json({ success: true, message: 'Staff member created', data });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /staff?hostelId= — hostel-scoped list for owner dashboard.
   * Omitting hostelId returns the owner's staff across all their hostels.
   */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });
      const headerHostel =
        typeof req.headers['x-hostel-id'] === 'string' ? req.headers['x-hostel-id'] : undefined;
      const queryHostel = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
      const result = await this.staffService.list(req.user!.userId, req.user!.role, {
        page,
        limit,
        hostelId: queryHostel ?? headerHostel,
        role: this.enumQuery(req.query.role, StaffRole, 'role'),
        shift: this.enumQuery(req.query.shift, StaffShift, 'shift'),
        status: this.enumQuery(req.query.status, StaffStatus, 'status'),
        search:
          typeof req.query.search === 'string' ? req.query.search.trim() || undefined : undefined,
      });
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.staffService.getById(
        req.user!.userId,
        req.user!.role,
        getRequiredParam(req, 'id'),
      );
      res.status(STATUS_CODE.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = pickStaffPhotoFile(req);
      const data = await this.staffService.update(
        req.user!.userId,
        req.user!.role,
        getRequiredParam(req, 'id'),
        req.body as UpdateStaffDto,
        file,
      );
      res.status(STATUS_CODE.OK).json({ success: true, message: 'Staff member updated', data });
    } catch (error) {
      next(error);
    }
  };

  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.staffService.remove(req.user!.userId, req.user!.role, getRequiredParam(req, 'id'));
      res.status(STATUS_CODE.DELETED).json({ success: true, message: 'Staff member deleted' });
    } catch (error) {
      next(error);
    }
  };

  private enumQuery<T extends Record<string, string>>(
    value: unknown,
    values: T,
    name: string,
  ): T[keyof T] | undefined {
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    const normalized = value
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    let alias = normalized;
    if (alias === 'SECURITYGUARD') alias = 'SECURITY_GUARD';
    if (alias === 'SECURITY') alias = 'GUARD';
    if (alias === 'FULLDAY') alias = 'FULL_DAY';
    if (alias === 'ONLEAVE') alias = 'ON_LEAVE';
    if (!(alias in values)) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, `${name} is invalid`);
    }
    return alias as T[keyof T];
  }
}
