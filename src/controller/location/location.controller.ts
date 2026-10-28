// ──────────────────────────────────────────────────────────────────────────────
// FILE: location.controller.ts
// PURPOSE: HTTP layer for hostel location sharing and coordinates endpoints.
// ──────────────────────────────────────────────────────────────────────────────

import { NextFunction, Request, Response } from 'express';
import { LocationService } from '../../services/location/location.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';
import { UpdateHostelLocationDto } from '../../dto/location/location.dto';

export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  public getLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const user = req.user
        ? {
            userId: req.user.userId,
            role: req.user.role ?? '',
          }
        : undefined;

      const result = await this.locationService.getLocation(hostelId, user);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateLocation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const user = {
        userId: req.user!.userId,
        role: req.user!.role ?? '',
      };
      const dto = req.body as UpdateHostelLocationDto;

      const result = await this.locationService.updateLocation(hostelId, user, dto);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Hostel location updated successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };
}
