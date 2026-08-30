import { NextFunction, Request, Response } from 'express';
import { FeeService } from '../../services/fee/fee.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';

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

  public listHostelFees = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, ...(await this.feeService.listHostelFees(hostelId)) });
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
}
