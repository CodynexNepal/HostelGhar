// ─────────────────────────────────────────────────────────────
// FILE: payment-proof.controller.ts
// PURPOSE: HTTP layer for payment proofs.
// ─────────────────────────────────────────────────────────────

import { NextFunction, Request, Response } from 'express';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CreatePaymentProofDto } from '../../dto/payment-proof/create-payment-proof.dto';
import { ReviewPaymentProofDto } from '../../dto/payment-proof/review-payment-proof.dto';
import { PaymentProofService } from '../../services/payment-proof/payment-proof.service';
import { PaymentProofStatus } from '../../enum/payment-proof.enum';
import { pickPaymentProofFile } from '../../middleware/upload.middleware';
import { normalizePagination } from '../../utils/pagination.util';
import { getRequiredParam } from '../../decorators/http.decorator';

export class PaymentProofController {
  constructor(private readonly proofService: PaymentProofService = new PaymentProofService()) {}

  public submitProof = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feeId = getRequiredParam(req, 'feeId');
      const dto = req.body as CreatePaymentProofDto;
      const file = pickPaymentProofFile(req);
      const data = await this.proofService.submitProof(req.user!.userId, req.user!.role, feeId, dto, file);
      res.status(STATUS_CODE.CREATED).json({ success: true, message: 'Payment proof submitted', data });
    } catch (error) {
      next(error);
    }
  };

  public listMyProofs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = normalizePagination({
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
      });
      const result = await this.proofService.listForResident(req.user!.userId, req.user!.role, { page, limit });
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  public listHostelProofs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const { page, limit } = normalizePagination({
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
      });
      const raw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
      const status = raw && raw in PaymentProofStatus ? (raw as PaymentProofStatus) : undefined;
      const result = await this.proofService.listForHostel(req.user!.userId, req.user!.role, hostelId, { page, limit }, status);
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  public listFeeProofs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feeId = getRequiredParam(req, 'feeId');
      const { page, limit } = normalizePagination({
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
      });
      const result = await this.proofService.listForFee(req.user!.userId, req.user!.role, feeId, { page, limit });
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  public reviewProof = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getRequiredParam(req, 'id');
      const dto = req.body as ReviewPaymentProofDto;
      const data = await this.proofService.reviewProof(req.user!.userId, req.user!.role, id, dto);
      res.status(STATUS_CODE.OK).json({ success: true, message: `Proof ${data.status.toLowerCase()}`, data });
    } catch (error) {
      next(error);
    }
  };
}
