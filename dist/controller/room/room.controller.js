"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.controller.ts
// PURPOSE: HTTP layer for Owner Room management with pagination & caching.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomController = void 0;
const room_enum_1 = require("../../enum/room.enum");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
const pagination_util_1 = require("../../utils/pagination.util");
const upload_middleware_1 = require("../../middleware/upload.middleware");
class RoomController {
    constructor(roomService) {
        this.roomService = roomService;
        /**
         * POST /api/v1/hostel-ghar/rooms — Owner creates a room (ownerId from JWT).
         * Accepts JSON or multipart/form-data (field `image` for room photo).
         */
        this.createRoom = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const dto = req.body;
                const file = (0, upload_middleware_1.pickRoomImageFile)(req);
                const result = await this.roomService.createRoom(ownerId, dto, file);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: 'Room created successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /api/v1/hostel-ghar/rooms — Paginated rooms of logged-in owner.
         * Query: page, limit, status, type, hostelId
         * NOTE: `includeUnlinked=0` hides rooms with hostelId NULL (strict hostel
         * scoping). Default includes them so owners always see rooms they added.
         */
        this.listMyRooms = async (req, res, next) => {
            try {
                const ownerId = req.user.userId;
                const { page, limit } = (0, pagination_util_1.normalizePagination)({
                    page: req.query.page,
                    limit: req.query.limit,
                });
                const status = typeof req.query.status === 'string' &&
                    Object.values(room_enum_1.RoomStatus).includes(req.query.status)
                    ? req.query.status
                    : undefined;
                const type = typeof req.query.type === 'string' &&
                    Object.values(room_enum_1.RoomType).includes(req.query.type)
                    ? req.query.type
                    : undefined;
                const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
                const includeUnlinked = req.query.includeUnlinked !== '0';
                const result = await this.roomService.listOwnerRooms(ownerId, { status, type, hostelId, includeUnlinked }, page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * GET /api/v1/hostel-ghar/rooms/:id — Single room detail (owner-scoped).
         */
        this.getRoom = async (req, res, next) => {
            try {
                const roomId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const ownerId = req.user.userId;
                const result = await this.roomService.getRoomById(roomId, ownerId);
                if ('error' in result && result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * PATCH /api/v1/hostel-ghar/rooms/:id — Owner partially updates their room.
         * Accepts JSON or multipart/form-data (field `image` to replace photo).
         */
        this.updateRoom = async (req, res, next) => {
            try {
                const roomId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const ownerId = req.user.userId;
                const dto = req.body;
                const file = (0, upload_middleware_1.pickRoomImageFile)(req);
                const result = await this.roomService.updateRoom(roomId, ownerId, dto, file);
                if (result.error) {
                    res.status(result.error.status).json({ success: false, message: result.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'Room updated successfully',
                    data: result.data,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.RoomController = RoomController;
