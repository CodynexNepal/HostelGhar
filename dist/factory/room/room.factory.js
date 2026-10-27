"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomFactory = void 0;
const room_controller_1 = require("../../controller/room/room.controller");
const room_repository_1 = require("../../repository/room/room.repository");
const room_service_1 = require("../../services/room/room.service");
class RoomFactory {
    constructor() { }
    static create() {
        const roomRepository = new room_repository_1.RoomRepository();
        const roomService = new room_service_1.RoomService(roomRepository);
        return new room_controller_1.RoomController(roomService);
    }
}
exports.RoomFactory = RoomFactory;
