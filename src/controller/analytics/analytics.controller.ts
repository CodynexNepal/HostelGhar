import { NextFunction, Request, Response } from 'express';
import { AnalyticsService } from '../../services/analytics/analytics.services';
import { STATUS_CODE } from '../../constant/statusCode.interface';

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Bootstrap for the admin dashboard page. `?refresh=1|true` forces a live DB
   * read (bypasses L1/L2) so the dashboard's Refresh button always re-reads.
   */
  public adminDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { data, isCached, cacheLevel } = await this.analyticsService.getAdminDashboard({
        refresh: req.query.refresh === '1' || req.query.refresh === 'true',
      });
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

  // Legacy alias of adminDashboard: identical payload (MRR included) so a client
  // pointed at /admin/dashboard/summary or /analytics/admin/summary still gets it.
  public adminSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, isCached, cacheLevel } = await this.analyticsService.getAdminSummary({
        refresh: req.query.refresh === '1' || req.query.refresh === 'true',
      });
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

  public ownerSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, isCached, cacheLevel } = await this.analyticsService.getOwnerSummary(
        req.user!.userId,
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
}
