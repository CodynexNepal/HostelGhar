"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.enum.ts
// PURPOSE: Central enums defining room classification types and availability status.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomStatus = exports.RoomType = void 0;
var RoomType;
(function (RoomType) {
    RoomType["SINGLE"] = "SINGLE";
    RoomType["DOUBLE"] = "DOUBLE";
    RoomType["TRIPLE"] = "TRIPLE";
    RoomType["QUAD"] = "QUAD";
    RoomType["DORMITORY"] = "DORMITORY";
})(RoomType || (exports.RoomType = RoomType = {}));
var RoomStatus;
(function (RoomStatus) {
    RoomStatus["AVAILABLE"] = "AVAILABLE";
    RoomStatus["OCCUPIED"] = "OCCUPIED";
    RoomStatus["RESERVED"] = "RESERVED";
    RoomStatus["MAINTENANCE"] = "MAINTENANCE";
})(RoomStatus || (exports.RoomStatus = RoomStatus = {}));
