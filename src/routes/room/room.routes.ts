// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.routes.ts
// PURPOSE: Room endpoints owned by Owner (JWT ownerId) with POST/PATCH/GET + pagination.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { RoomFactory } from '../../factory/room/room.factory';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreateRoomDto } from '../../dto/room/create-room.dto';
import { UpdateRoomDto } from '../../dto/room/update-room.dto';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';
import { stripFileFields, uploadRoomImage } from '../../middleware/upload.middleware';

const roomRouter: Router = Router();
const roomController = RoomFactory.create();

// All room routes require auth; writes restricted to OWNER (ADMIN can read/update too)
roomRouter.use(authenticate);

// POST /rooms — Owner creates a room (ownerId from JWT). Supports JSON or multipart image.
roomRouter.post(
  '/',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  uploadRoomImage,
  stripFileFields('image'),
  validateDto(CreateRoomDto),
  roomController.createRoom,
);

// GET /rooms — Paginated rooms of logged-in owner (?page=&limit=&status=&type=&hostelId=)
roomRouter.get(
  '/',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  apiReadLimiter,
  roomController.listMyRooms,
);

// GET /rooms/:id — Single owner room detail
roomRouter.get(
  '/:id',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('id'),
  apiReadLimiter,
  roomController.getRoom,
);

// PATCH /rooms/:id — Owner partially updates their room (JSON or multipart image)
roomRouter.patch(
  '/:id',
  requireRoles(IROLES.OWNER, IROLES.ADMIN),
  requireParam('id'),
  uploadRoomImage,
  stripFileFields('image'),
  validateDto(UpdateRoomDto),
  roomController.updateRoom,
);

export { roomRouter };
