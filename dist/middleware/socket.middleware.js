"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: socket.middleware.ts
// PURPOSE: Middleware that decorates every incoming Express request with Socket.io
//          broadcasting helpers, allowing ALL endpoints to emit real-time updates.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketContextMiddleware = void 0;
const socket_server_1 = require("../socket/socket.server");
/**
 * Express middleware to inject socket helpers into req object on all routes
 */
const socketContextMiddleware = (req, _res, next) => {
    const noop = () => {
        // Socket server not ready yet — real-time emit safely skipped.
    };
    // Always assign safe no-op fallbacks FIRST so downstream controllers can
    // never crash on `req.notifyUser is not a function`, even pre-init.
    req.notifyUser = noop;
    req.notifyHostel = noop;
    req.notifyRole = noop;
    req.notifyRoom = noop;
    req.broadcastEvent = noop;
    try {
        const io = socket_server_1.socketServer.getIO();
        req.io = io;
        req.notifyUser = (userId, event, data) => socket_server_1.socketServer.toUser(userId, event, data);
        req.notifyHostel = (hostelId, event, data) => socket_server_1.socketServer.toHostel(hostelId, event, data);
        req.notifyRole = (role, event, data) => socket_server_1.socketServer.toRole(role, event, data);
        req.notifyRoom = (room, event, data) => socket_server_1.socketServer.toRoom(room, event, data);
        req.broadcastEvent = (event, data) => socket_server_1.socketServer.broadcast(event, data);
    }
    catch (err) {
        // If socket server isn't initialized yet, keep the no-op fallbacks above.
        console.warn(`[SocketMiddleware] Socket server not available: ${err.message}`);
    }
    next();
};
exports.socketContextMiddleware = socketContextMiddleware;
