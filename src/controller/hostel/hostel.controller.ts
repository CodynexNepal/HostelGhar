import { NextFunction, Request, Response } from 'express';
import { HostelService } from '../../services/hostel/hostel.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';
import { normalizePagination } from '../../utils/pagination.util';

export class HostelController {
  constructor(private readonly hostelService: HostelService) {}

  public listHostels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });

      const result = await this.hostelService.listHostels(page, limit);
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  public getHostel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      const result = await this.hostelService.getHostel(hostelId);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }
      res.status(STATUS_CODE.OK).json({
        success: true,
        data: result.data,
        isCached: result.isCached,
        cacheLevel: result.cacheLevel,
      });
    } catch (error) {
      next(error);
    }
  };

  public getResidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      const result = await this.hostelService.getHostelResidents(hostelId);
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  public getLeaveTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      const result = await this.hostelService.getHostelLeaveTypes(hostelId);
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
