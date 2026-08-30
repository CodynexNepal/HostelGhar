import { NextFunction, Request, Response } from 'express';
import { AnalyticsService } from '../../services/analytics/analytics.services';
import { STATUS_CODE } from '../../constant/statusCode.interface';

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  public adminSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, data: await this.analyticsService.getAdminSummary() });
    } catch (error) {
      next(error);
    }
  };

  public ownerSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(STATUS_CODE.OK).json({
        success: true,
        data: await this.analyticsService.getOwnerSummary(req.user!.userId),
      });
    } catch (error) {
      next(error);
    }
  };
}
