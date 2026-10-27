"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.routes.ts
// PURPOSE: Room endpoints owned by Owner (JWT ownerId) with POST/PATCH/GET + pagination.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomRouter = void 0;
const express_1 = require("express");
const room_factory_1 = require("../../factory/room/room.factory");
const validate_dto_middleware_1 = require("../../middleware/validate-dto.middleware");
const create_room_dto_1 = require("../../dto/room/create-room.dto");
const update_room_dto_1 = require("../../dto/room/update-room.dto");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const rateLimiter_config_1 = require("../../configs/rateLimiter.config");
const http_decorator_1 = require("../../decorators/http.decorator");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const roomRouter = (0, express_1.Router)();
exports.roomRouter = roomRouter;
const roomController = room_factory_1.RoomFactory.create();
// All room routes require auth; writes restricted to OWNER (ADMIN can read/update too)
roomRouter.use(auth_middleware_1.authenticate);
// POST /rooms — Owner creates a room (ownerId from JWT). Supports JSON or multipart image.
roomRouter.post('/', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), upload_middleware_1.uploadRoomImage, (0, upload_middleware_1.stripFileFields)('image'), (0, validate_dto_middleware_1.validateDto)(create_room_dto_1.CreateRoomDto), roomController.createRoom);
// GET /rooms — Paginated rooms of logged-in owner (?page=&limit=&status=&type=&hostelId=)
roomRouter.get('/', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), rateLimiter_config_1.apiReadLimiter, roomController.listMyRooms);
// GET /rooms/:id — Single owner room detail
roomRouter.get('/:id', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('id'), rateLimiter_config_1.apiReadLimiter, roomController.getRoom);
// PATCH /rooms/:id — Owner partially updates their room (JSON or multipart image)
roomRouter.patch('/:id', (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN), (0, http_decorator_1.requireParam)('id'), upload_middleware_1.uploadRoomImage, (0, upload_middleware_1.stripFileFields)('image'), (0, validate_dto_middleware_1.validateDto)(update_room_dto_1.UpdateRoomDto), roomController.updateRoom);
