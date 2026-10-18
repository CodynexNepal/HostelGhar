// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.controller.ts
// PURPOSE: HTTP layer for attendance — owner/admin listing and resident
//          self check-in / history. Thin: parsing + status codes only.
// ──────────────────────────────────────────────────────────────────────────────

import { NextFunction, Request, Response } from 'express';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { MarkAttendanceDto } from '../../dto/attendance/mark-attendance.dto';
import { AttendanceStatus } from '../../enum/attendance.enum';
import { AttendanceService } from '../../services/attendance/attendance.service';
import { createHttpError } from '../../utils/createHttpError';
import { normalizePagination } from '../../utils/pagination.util';

export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * GET /owner/attendance?hostelId=&residentId=&date=&status=&page=&limit=
   * Owner/Admin: attendance records for a hostel (or all owned hostels).
   */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });
      const headerHostel =
        typeof req.headers['x-hostel-id'] === 'string' ? req.headers['x-hostel-id'] : undefined;
      const queryHostel =
        typeof req.query.hostelId === 'string' ? req.query.hostelId.trim() : undefined;
      const result = await this.attendanceService.list(req.user!.userId, req.user!.role, {
        page,
        limit,
        hostelId: queryHostel ?? headerHostel,
        residentId:
          typeof req.query.residentId === 'string' ? req.query.residentId.trim() : undefined,
        date: typeof req.query.date === 'string' ? req.query.date.trim() : undefined,
        status: this.enumQuery(req.query.status),
      });
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /resident/attendance/check-in
   * Resident: marks self PRESENT/LATE for today (Nepal date).
   */
  public checkIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.attendanceService.checkIn(
        req.user!.userId,
        req.body as MarkAttendanceDto,
      );
      res
        .status(STATUS_CODE.CREATED)
        .json({ success: true, message: 'Checked in successfully', data });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /resident/attendance/check-out
   * Resident: marks self checked out for today (Nepal date).
   */
  public checkOut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.attendanceService.checkOut(req.user!.userId);
      res.status(STATUS_CODE.OK).json({ success: true, message: 'Checked out successfully', data });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /resident/attendance — the resident's own attendance history.
   */
  public getMyAttendance = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });
      const result = await this.attendanceService.getMyAttendance(req.user!.userId, page, limit);
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  private enumQuery(value: unknown): AttendanceStatus | undefined {
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    const normalized = value
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    if (!(normalized in AttendanceStatus)) {
      throw createHttpError(
        STATUS_CODE.BAD_REQUEST,
        'status must be one of: PRESENT, ABSENT, LATE, HALF_DAY, ON_LEAVE',
      );
    }
    return normalized as AttendanceStatus;
  }
}
