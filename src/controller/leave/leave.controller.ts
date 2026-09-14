import { NextFunction, Request, Response } from 'express';
import { LeaveService } from '../../services/leave/leave.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';
import { normalizePagination } from '../../utils/pagination.util';

export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  public listHostelLeaves = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });

      const result = await this.leaveService.listHostelLeaves(
        hostelId,
        req.query.status as string | undefined,
        page,
        limit,
      );
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const leaveId = getRequiredParam(req, 'id');
      const result = await this.leaveService.updateLeaveStatus(
        leaveId,
        req.body.status,
        req.user!.userId,
      );
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }
      res.status(STATUS_CODE.OK).json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  };
}
