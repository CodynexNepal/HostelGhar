import { NextFunction, Request, Response } from 'express';
import { HostelService } from '../../services/hostel/hostel.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';

export class HostelController {
  constructor(private readonly hostelService: HostelService) {}

  public listHostels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, ...(await this.hostelService.listHostels(page, limit)) });
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
      res.status(STATUS_CODE.OK).json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  };

  public getResidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, ...(await this.hostelService.getHostelResidents(hostelId)) });
    } catch (error) {
      next(error);
    }
  };

  public getLeaveTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, ...(await this.hostelService.getHostelLeaveTypes(hostelId)) });
    } catch (error) {
      next(error);
    }
  };
}
