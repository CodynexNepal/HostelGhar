// ─────────────────────────────────────────────────────────────
// FILE: facility.controller.ts
// PURPOSE: HTTP layer — hostel id ALWAYS from :hostelId param.
// ─────────────────────────────────────────────────────────────
import { NextFunction, Request, Response } from 'express';
import { FacilityService } from '../../services/facility/facility.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';
import { UpsertFacilityItemDto, SyncHostelFacilitiesDto } from '../../dto/facility/facility.dto';

export class FacilityController {
  constructor(private readonly service: FacilityService) {}

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const r = await this.service.list(hostelId);
      if ('error' in r) { res.status(r.error.status).json({ success: false, message: r.error.message }); return; }
      res.status(STATUS_CODE.OK).json({ success: true, ...r });
    } catch (e) { next(e); }
  };

  public sync = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const dto = req.body as SyncHostelFacilitiesDto;
      const items = (dto.facilities ?? []).map((f: UpsertFacilityItemDto) => ({
        clientKey: f.id?.trim() ? f.id.trim() : null,
        title: f.title.trim(),
        description: f.description?.trim() ? f.description : null,
        tag: f.tag,
      }));
      const r = await this.service.sync(hostelId, items);
      if ('error' in r) { res.status(r.error.status).json({ success: false, message: r.error.message }); return; }
      res.status(STATUS_CODE.OK).json({ success: true, message: 'Facilities synced', ...r });
    } catch (e) { next(e); }
  };

  public add = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const f = req.body as UpsertFacilityItemDto;
      const r = await this.service.add(hostelId, {
        clientKey: f.id?.trim() ? f.id.trim() : null,
        title: f.title.trim(),
        description: f.description?.trim() ? f.description : null,
        tag: f.tag,
      });
      if ('error' in r) { res.status(r.error.status).json({ success: false, message: r.error.message }); return; }
      res.status(STATUS_CODE.CREATED).json({ success: true, message: 'Facility added', ...r });
    } catch (e) { next(e); }
  };

  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const fkey = getRequiredParam(req, 'facilityKey');
      const r = await this.service.remove(hostelId, fkey);
      if ('error' in r) { res.status(r.error.status).json({ success: false, message: r.error.message }); return; }
      res.status(STATUS_CODE.OK).json({ success: true, message: 'Facility removed', ...r });
    } catch (e) { next(e); }
  };
}
