// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.controller.ts
// PURPOSE: HTTP layer for Owner Room management with pagination & caching.
// ──────────────────────────────────────────────────────────────────────────────

import { NextFunction, Request, Response } from 'express';
import { CreateRoomDto } from '../../dto/room/create-room.dto';
import { UpdateRoomDto } from '../../dto/room/update-room.dto';
import { RoomStatus, RoomType } from '../../enum/room.enum';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { RoomService } from '../../services/room/room.service';
import { getRequiredParam } from '../../decorators/http.decorator';
import { normalizePagination } from '../../utils/pagination.util';
import { pickRoomImageFile } from '../../middleware/upload.middleware';

export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  /**
   * POST /api/v1/hostel-ghar/rooms — Owner creates a room (ownerId from JWT).
   * Accepts JSON or multipart/form-data (field `image` for room photo).
   */
  public createRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const dto = req.body as CreateRoomDto;
      const file = pickRoomImageFile(req);

      const result = await this.roomService.createRoom(ownerId, dto, file);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Room created successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/hostel-ghar/rooms — Paginated rooms of logged-in owner.
   * Query: page, limit, status, type, hostelId
   * NOTE: `includeUnlinked=0` hides rooms with hostelId NULL (strict hostel
   * scoping). Default includes them so owners always see rooms they added.
   */
  public listMyRooms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });

      const status =
        typeof req.query.status === 'string' &&
        Object.values(RoomStatus).includes(req.query.status as RoomStatus)
          ? (req.query.status as RoomStatus)
          : undefined;
      const type =
        typeof req.query.type === 'string' &&
        Object.values(RoomType).includes(req.query.type as RoomType)
          ? (req.query.type as RoomType)
          : undefined;
      const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
      const includeUnlinked = req.query.includeUnlinked !== '0';

      const result = await this.roomService.listOwnerRooms(
        ownerId,
        { status, type, hostelId, includeUnlinked },
        page,
        limit,
      );

      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/hostel-ghar/rooms/:id — Single room detail (owner-scoped).
   */
  public getRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roomId = getRequiredParam(req, 'id');
      const ownerId = req.user!.userId;

      const result = await this.roomService.getRoomById(roomId, ownerId);
      if ('error' in result && result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/hostel-ghar/rooms/:id — Owner partially updates their room.
   * Accepts JSON or multipart/form-data (field `image` to replace photo).
   */
  public updateRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roomId = getRequiredParam(req, 'id');
      const ownerId = req.user!.userId;
      const dto = req.body as UpdateRoomDto;
      const file = pickRoomImageFile(req);

      const result = await this.roomService.updateRoom(roomId, ownerId, dto, file);
      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: 'Room updated successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };
}
