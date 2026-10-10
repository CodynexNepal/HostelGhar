// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.controller.ts
// PURPOSE: HTTP handlers for Hostel Ghar PLATFORM checkout QRs. Admin CRUD lives
//          under /admin/platform-qrs; owners read the active list (mounted by
//          the public router). Mirrors the payment-qr controller's envelope.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { PlatformQrService } from '../../services/platform-qr/platform-qr.service';
import { CreatePlatformQrDto } from '../../dto/platform-qr/create-platform-qr.dto';
import { UpdatePlatformQrDto } from '../../dto/platform-qr/update-platform-qr.dto';
import { pickPlatformQrFile } from '../../middleware/upload.middleware';
import { getRequiredParam } from '../../decorators/http.decorator';

export class PlatformQrController {
  constructor(private readonly platformQrService: PlatformQrService = new PlatformQrService()) {}

  /** GET /admin/platform-qrs — list every configured checkout QR (admin). */
  public listAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.platformQrService.listAll();
      res.status(STATUS_CODE.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  /** GET /platform-qrs — active checkout QRs owners scan on /subscription. */
  public listActive = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.platformQrService.listActive();
      res.status(STATUS_CODE.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  /** POST /admin/platform-qrs — upload a checkout QR (multipart `qrImage` or JSON url). */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = req.body as CreatePlatformQrDto;
      const file = pickPlatformQrFile(req);
      const data = await this.platformQrService.create(dto, file);
      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Platform QR created successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /** PUT /admin/platform-qrs/:id — replace image and/or label. */
  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getRequiredParam(req, 'id');
      const dto = req.body as UpdatePlatformQrDto;
      const file = pickPlatformQrFile(req);
      const data = await this.platformQrService.update(id, dto, file);
      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Platform QR updated successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /admin/platform-qrs/:id — remove a checkout QR. */
  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getRequiredParam(req, 'id');
      const data = await this.platformQrService.remove(id);
      res.status(STATUS_CODE.OK).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };
}
