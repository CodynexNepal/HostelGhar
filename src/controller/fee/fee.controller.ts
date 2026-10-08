import { NextFunction, Request, Response } from 'express';
import { FeeService } from '../../services/fee/fee.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';
import { normalizePagination } from '../../utils/pagination.util';
import { FeeStatus } from '../../enum/fee.enum';
import { UpdateFeeStatusDto } from '../../dto/fee/update-fee-status.dto';
import {
  isFirstDayOfNepaliMonth,
  toNepaliDate,
  formatNepaliMonthYear,
} from '../../utils/nepali-date.util';

export class FeeController {
  constructor(private readonly feeService: FeeService) {}

  public generateMonthlyFees = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.feeService.generateMonthlyFeesForAllHostels();
      res.status(STATUS_CODE.OK).json({ success: true, result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /fees/nepali-status — is today Nepali 1st? When will billing run?
   * Public helper for dashboards ("Next bill: 1 Kartik 2083").
   */
  public nepaliBillingStatus = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const now = new Date();
      const bs = toNepaliDate(now);
      res.status(STATUS_CODE.OK).json({
        success: true,
        data: {
          todayBs: bs,
          todayBsLabel: `${bs.day} ${formatNepaliMonthYear(bs)} BS`,
          isNepaliFirstDay: isFirstDayOfNepaliMonth(now),
          currentBillingMonth: formatNepaliMonthYear(bs),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public listHostelFees = async (
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

      const result = await this.feeService.listHostelFees(hostelId, page, limit);
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  public recordPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feeId = getRequiredParam(req, 'id');
      const result = await this.feeService.recordPayment(
        feeId,
        Number(req.body.paidAmount),
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

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feeId = getRequiredParam(req, 'id');
      const body = req.body as UpdateFeeStatusDto;
      // Canonical wins when several aliases are sent together.
      const rawStatus = body.status ?? body.feeStatus ?? body.paymentStatus ?? body.payment_status;
      const status = typeof rawStatus === 'string' ? rawStatus.trim().toUpperCase() : rawStatus;
      if (!status || !Object.values(FeeStatus).includes(status as FeeStatus)) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: 'status must be one of: PENDING, PAID, OVERDUE, PARTIALLY_PAID',
        });
        return;
      }
      const rawPaidAmount = body.paidAmount ?? body.amount;
      const result = await this.feeService.updateFeeStatus(
        feeId,
        status as FeeStatus,
        req.user!.userId,
        rawPaidAmount !== undefined ? Number(rawPaidAmount) : undefined,
      );
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, message: `Fee status updated to ${status}` });
    } catch (error) {
      next(error);
    }
  };
}
