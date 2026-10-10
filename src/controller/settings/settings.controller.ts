// ──────────────────────────────────────────────────────────────────────────────
// FILE: settings.controller.ts
// PURPOSE: Admin settings HTTP controller delegating entirely to SettingsService.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { SettingsService, SettingsSection } from '../../services/settings/settings.service';

const VALID_SECTIONS: SettingsSection[] = ['general', 'billing', 'access', 'alerts', 'system'];

export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  public getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.settingsService.getAll();
      res.status(STATUS_CODE.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public getSection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const section = String(req.params.section || '').toLowerCase() as SettingsSection;
      if (!VALID_SECTIONS.includes(section)) {
        res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: `Unknown settings section "${req.params.section}". Valid sections: ${VALID_SECTIONS.join(', ')}`,
        });
        return;
      }
      const data = await this.settingsService.getSection(section);
      res.status(STATUS_CODE.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public updateSection = (section: SettingsSection) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const data = await this.settingsService.updateSection(section, req.body ?? {});
        res.status(STATUS_CODE.OK).json({
          success: true,
          message: `${section} settings updated successfully`,
          data,
        });
      } catch (error) {
        next(error);
      }
    };
  };
}
