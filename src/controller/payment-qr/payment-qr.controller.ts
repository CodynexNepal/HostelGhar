// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.controller.ts
// PURPOSE: HTTP Controller for Hostel Payment QR Codes (eSewa, Khalti, Bank Transfer).
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { IROLES } from '../../enum/roles.enum';
import { PaymentQrService } from '../../services/payment-qr/payment-qr.service';
import { CreatePaymentQrDto } from '../../dto/payment-qr/create-payment-qr.dto';
import { UpdatePaymentQrDto } from '../../dto/payment-qr/update-payment-qr.dto';
import { PatchPaymentQrDto } from '../../dto/payment-qr/patch-payment-qr.dto';
import { LoadDemoQrDto } from '../../dto/payment-qr/load-demo-qr.dto';
import { pickPaymentQrFile } from '../../middleware/upload.middleware';

export class PaymentQrController {
  constructor(private readonly qrService: PaymentQrService = new PaymentQrService()) {}

  /**
   * GET /payment-qrs
   * Dispatches automatically based on user role:
   * - RESIDENT: returns active QRs for resident's hostel under "My Payments"
   * - OWNER/ADMIN: returns all QRs for the specified or managed hostel
   */
  public listPaymentQrs = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const role = user.role?.toLowerCase();

      if (role === IROLES.RESIDENT.toLowerCase()) {
        const result = await this.qrService.getResidentPaymentQrs(user.userId);
        res.status(STATUS_CODE.OK).json({
          success: true,
          data: result,
        });
        return;
      }

      const hostelId =
        (req.query.hostelId as string | undefined) ||
        req.hostelId ||
        (req.headers['x-hostel-id'] as string | undefined);

      const isActiveFilter =
        req.query.isActive !== undefined
          ? req.query.isActive === 'true' || req.query.isActive === '1'
          : undefined;

      const result = await this.qrService.listPaymentQrsForHostel(
        user.userId,
        user.role,
        hostelId,
        isActiveFilter,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /payment-qrs/resident
   * Explicit endpoint for Resident view (used under "My Payments")
   */
  public getResidentPaymentQrs = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const hostelId = (req.query.hostelId as string | undefined) || req.hostelId;
      const result = await this.qrService.getResidentPaymentQrs(user.userId, hostelId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /payment-qrs/preview
   * "Preview Resident View": Allows owners/admins to preview what residents see
   */
  public previewResidentView = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const hostelId =
        (req.query.hostelId as string | undefined) ||
        req.hostelId ||
        (req.headers['x-hostel-id'] as string | undefined);

      const result = await this.qrService.previewResidentView(user.userId, user.role, hostelId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /payment-qrs/:id
   * Get single Payment QR by ID
   */
  public getPaymentQrById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const qr = await this.qrService.getPaymentQrById(user.userId, user.role, id as string);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: qr,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /payment-qrs
   * Create a new payment QR code (supports file upload or image URL)
   */
  public createPaymentQr = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const dto = req.body as CreatePaymentQrDto;
      const file = pickPaymentQrFile(req);

      const qr = await this.qrService.createPaymentQr(user.userId, user.role, dto, file);

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Payment QR code created successfully',
        data: qr,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /payment-qrs/demo
   * "Load Demo QRs": Seeds standard eSewa, Khalti, and Bank Transfer QRs
   */
  public loadDemoQRs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const dto = req.body as LoadDemoQrDto;
      const hostelId =
        dto?.hostelId ||
        (req.query.hostelId as string | undefined) ||
        req.hostelId ||
        (req.headers['x-hostel-id'] as string | undefined);

      const result = await this.qrService.loadDemoQRs(user.userId, user.role, hostelId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /payment-qrs/:id
   * "Replace QR" / Full Update: Replaces the QR image and/or details
   */
  public replacePaymentQr = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const dto = req.body as UpdatePaymentQrDto;
      const file = pickPaymentQrFile(req);

      const updated = await this.qrService.replacePaymentQr(
        user.userId,
        user.role,
        id as string,
        dto,
        file,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Payment QR code replaced successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /payment-qrs/:id
   * Partial update
   */
  public patchPaymentQr = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const dto = req.body as PatchPaymentQrDto;
      const file = pickPaymentQrFile(req);

      const updated = await this.qrService.patchPaymentQr(
        user.userId,
        user.role,
        id as string,
        dto,
        file,
      );

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Payment QR code updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /payment-qrs/:id/toggle
   * Toggle Active / Inactive status
   */
  public toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const updated = await this.qrService.toggleActiveStatus(user.userId, user.role, id as string);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: `Payment QR code is now ${updated.isActive ? 'active' : 'inactive'}`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /payment-qrs/:id
   * "Remove" payment QR code
   */
  public deletePaymentQr = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const result = await this.qrService.deletePaymentQr(user.userId, user.role, id as string);

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: result.message,
        data: { id: result.id },
      });
    } catch (error) {
      next(error);
    }
  };
}
