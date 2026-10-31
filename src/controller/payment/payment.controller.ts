// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.controller.ts
// PURPOSE: HTTP controllers for recording payments, retrieving audit history,
//          downloading receipts, and managing overdue balances.
// ──────────────────────────────────────────────────────────────────────────────

import { NextFunction, Request, Response } from 'express';
import { paymentService } from '../../services/payment/payment.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';
import { normalizePagination } from '../../utils/pagination.util';
import { RecordPaymentDto } from '../../dto/payment/record-payment.dto';
import { PaymentMethod, PaymentStatus } from '../../enum/payment.enum';

export class PaymentController {
  constructor(private readonly service = paymentService) {}

  /**
   * POST /fees/:id/payments
   * Owner/Admin records a manual or cash payment against an invoice.
   */
  public recordPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feeId = getRequiredParam(req, 'id');
      const body = req.body as RecordPaymentDto;
      const result = await this.service.recordPayment(
        req.user!.userId,
        req.user!.role,
        feeId,
        body,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: result.isDuplicate
          ? 'Duplicate payment request: already processed'
          : 'Payment recorded successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /resident/fees/:id/pay
   * Resident initiates/records payment against their own fee.
   */
  public residentPay = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feeId = getRequiredParam(req, 'id');
      const body = req.body as RecordPaymentDto;
      const result = await this.service.recordPayment(
        req.user!.userId,
        req.user!.role,
        feeId,
        body,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: result.isDuplicate
          ? 'Payment was already processed'
          : 'Payment processed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /fees/:id
   * Detailed invoice data with payment transaction history.
   */
  public getInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feeId = getRequiredParam(req, 'id');
      const fee = await this.service.getInvoiceDetails(req.user!.userId, req.user!.role, feeId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: fee,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /fees/hostels/:hostelId/payments
   * Lists all payment transactions for a hostel with search, date & method filters.
   */
  public getHostelPayments = async (
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

      const filters = {
        status: req.query.status as PaymentStatus | undefined,
        paymentMethod: req.query.method as PaymentMethod | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        search: req.query.search as string | undefined,
      };

      const result = await this.service.getHostelPayments(
        req.user!.userId,
        req.user!.role,
        hostelId,
        page,
        limit,
        filters,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /resident/payments
   * Returns student's individual payment transaction history.
   */
  public getResidentPayments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });

      const result = await this.service.getResidentPayments(req.user!.userId, page, limit);

      res.status(STATUS_CODE.OK).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /payments/:id/receipt
   * Download / print receipt payload for an authorized payment.
   */
  public getReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentId = getRequiredParam(req, 'id');
      const receipt = await this.service.getReceipt(req.user!.userId, req.user!.role, paymentId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: receipt,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /fees/sync-overdue
   * Evaluates due dates and updates overdue statuses.
   */
  public syncOverdue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = req.query.hostelId as string | undefined;
      const count = await this.service.syncOverdueFees(hostelId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: `Synced ${count} overdue invoice(s)`,
        count,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const paymentController = new PaymentController();
