// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.controller.ts
// PURPOSE: HTTP layer for weekly meals schedule endpoints.
// ──────────────────────────────────────────────────────────────────────────────

import { NextFunction, Request, Response } from 'express';
import { MealService } from '../../services/meal/meal.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';
import { SaveWeeklyMealsDto } from '../../dto/meal/meal.dto';

export class MealController {
  constructor(private readonly mealService: MealService) {}

  public getSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const user = req.user
        ? {
            userId: req.user.userId,
            role: req.user.role ?? '',
          }
        : undefined;

      const result = await this.mealService.getWeeklySchedule(hostelId, user);
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

  public saveSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const user = {
        userId: req.user!.userId,
        role: req.user!.role ?? '',
      };
      const dto = req.body as SaveWeeklyMealsDto;

      const result = await this.mealService.saveWeeklySchedule(hostelId, user, dto.meals);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Weekly meal schedule saved successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  public clearSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const user = {
        userId: req.user!.userId,
        role: req.user!.role ?? '',
      };

      const result = await this.mealService.clearWeeklySchedule(hostelId, user);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Weekly meal schedule cleared successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  // ─── DAILY MEAL SCHEDULE HANDLERS (दैनिक भोजन तालिका) ─────────────────────

  public getDailySchedule = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const user = req.user
        ? {
            userId: req.user.userId,
            role: req.user.role ?? '',
          }
        : undefined;

      const result = await this.mealService.getDailySchedule(hostelId, user);
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

  public createDailyMeal = async (
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

      const result = await this.mealService.createDailyMeal(hostelId, user, req.body);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Daily meal item created successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateDailyMeal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const mealId = getRequiredParam(req, 'id');
      const user = {
        userId: req.user!.userId,
        role: req.user!.role ?? '',
      };

      const result = await this.mealService.updateDailyMeal(hostelId, mealId, user, req.body);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Daily meal item updated successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  public deleteDailyMeal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'hostelId');
      const mealId = getRequiredParam(req, 'id');
      const user = {
        userId: req.user!.userId,
        role: req.user!.role ?? '',
      };

      const result = await this.mealService.deleteDailyMeal(hostelId, mealId, user);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Daily meal item deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public saveDailySchedule = async (
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
      const meals = Array.isArray(req.body?.meals) ? req.body.meals : req.body;

      const result = await this.mealService.saveDailySchedule(hostelId, user, meals);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Daily meal schedule saved successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  public clearDailySchedule = async (
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

      const result = await this.mealService.clearDailySchedule(hostelId, user);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Daily meal schedule cleared successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };
}
