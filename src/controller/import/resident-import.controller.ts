// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident-import.controller.ts
// PURPOSE: Thin HTTP adapter for Import Residents UI: template download,
//          background CSV enqueue (202), history list, detail, plan limits.
// ──────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { pickResidentCsvFile } from '../../middleware/upload.middleware';
import { residentImportService } from '../../services/resident/resident-import.service';

export class ResidentImportController {
  public downloadTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tpl = residentImportService.getTemplate();
      res.setHeader('Content-Type', tpl.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${tpl.fileName}"`);
      res.status(STATUS_CODE.OK).send(tpl.content);
    } catch (error) {
      next(error);
    }
  };

  public getPlanLimits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res
        .status(STATUS_CODE.OK)
        .json({ success: true, data: residentImportService.getPlanLimits() });
    } catch (error) {
      next(error);
    }
  };

  public startImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const role = req.user!.role?.toLowerCase() ?? '';
      // resolveHostelId runs before multer, so req.hostelId is authoritative.
      // Fallback covers clients that send hostelId as multipart text field.
      const rawHostel = req.hostelId ?? (req.body?.hostelId as string | undefined);
      const hostelId = typeof rawHostel === 'string' ? rawHostel.trim() : rawHostel;
      if (!hostelId) {
        res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: 'hostelId required' });
        return;
      }
      const file = pickResidentCsvFile(req);
      if (!file?.buffer) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message:
            'CSV file required in the multipart upload. Use a valid CSV file field such as "file" or "csv".',
        });
        return;
      }
      const idem = req.headers['idempotency-key'];
      const result = await residentImportService.enqueueImport({
        hostelId,
        ownerId,
        role,
        fileName: file.originalname || 'residents.csv',
        fileBuffer: file.buffer,
        idempotencyKey: typeof idem === 'string' ? idem : undefined,
      });
      if (result.error || !result.data) {
        const status = result.error?.status ?? STATUS_CODE.BAD_REQUEST;
        res.status(status).json({
          success: false,
          message: result.error?.message ?? 'Import failed',
          errors: result.error?.details ?? undefined,
        });
        return;
      }
      res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        replayed: result.data.replayed,
        message: result.data.replayed
          ? 'Import already queued (idempotent replay)'
          : 'Import queued for background processing',
        data: result.data.import,
      });
    } catch (error) {
      next(error);
    }
  };

  public getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const role = req.user!.role?.toLowerCase() ?? '';
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
      const result = await residentImportService.getHistory({
        ownerId,
        role,
        page,
        limit,
        hostelId,
      });
      if (result.error || !result.data) {
        res
          .status(result.error?.status ?? 500)
          .json({ success: false, message: result.error?.message ?? 'Failed' });
        return;
      }
      res.status(STATUS_CODE.OK).json({ success: true, ...result.data });
    } catch (error) {
      next(error);
    }
  };

  public getDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const role = req.user!.role?.toLowerCase() ?? '';
      const importId = req.params.id as string;
      const result = await residentImportService.getDetail({ importId, ownerId, role });
      if (result.error || !result.data) {
        res
          .status(result.error?.status ?? 500)
          .json({ success: false, message: result.error?.message ?? 'Failed' });
        return;
      }
      res.status(STATUS_CODE.OK).json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  };
}

export const residentImportController = new ResidentImportController();
