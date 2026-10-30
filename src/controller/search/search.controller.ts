// ──────────────────────────────────────────────────────────────────────────────
// FILE: search.controller.ts
// PURPOSE: HTTP handler for unified global search across all roles.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { searchService, SearchService } from '../../services/search/search.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';

export class SearchController {
  constructor(private readonly service: SearchService = searchService) {}

  public search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;

      const data = await this.service.search(userId, role, q, category, limit, hostelId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const searchController = new SearchController();
