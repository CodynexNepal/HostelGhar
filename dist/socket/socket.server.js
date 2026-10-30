"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: socket.server.ts
// PURPOSE: Enterprise Socket.io server instance with Redis Adapter for horizontal
//          scaling, JWT handshake authentication, room joins, and scoped emits.
// ──────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketServer = void 0;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_config_1 = require("../configs/redis.config");
const envConfig_1 = require("../configs/envConfig");
const socket_config_1 = require("../configs/socket.config");
const queue_constants_1 = require("../constant/queue.constants");
class SocketService {
    constructor() {
        this.io = null;
        this.pubClient = null;
        this.subClient = null;
    }
    init(httpServer) {
        const isPassenger = typeof global.PhusionPassenger !== 'undefined' ||
            process.env.PASSENGER_MODE === 'true';
        const isRedisDisabled = !envConfig_1.dotEnvConfig.ENABLE_REDIS ||
            envConfig_1.dotEnvConfig.USE_DIRECT_SMTP ||
            (isPassenger && process.env.ENABLE_WORKERS !== 'true');
        let redisAdapter = undefined;
        if (!isRedisDisabled) {
            try {
                if (!this.pubClient || this.pubClient.status === 'end') {
                    this.pubClient = (0, redis_config_1.createRedisClient)('socket-pub');
                }
                if (!this.subClient || this.subClient.status === 'end') {
                    this.subClient = (0, redis_config_1.createRedisClient)('socket-sub');
                }
                redisAdapter = (0, redis_adapter_1.createAdapter)(this.pubClient, this.subClient);
                console.log('⚡ Socket.io Server initialized with Redis Adapter');
            }
            catch {
                console.warn('⚡ Redis adapter unavailable; falling back to in-memory Socket.io adapter');
            }
        }
        else {
            console.log('⚡ Socket.io Server initialized with in-memory adapter (cPanel / standalone mode)');
        }
        this.io = new socket_io_1.Server(httpServer, {
            cors: socket_config_1.socketConfig.cors,
            ...(redisAdapter ? { adapter: redisAdapter } : {}),
            transports: socket_config_1.socketConfig.transports,
            pingTimeout: socket_config_1.socketConfig.pingTimeout,
            pingInterval: socket_config_1.socketConfig.pingInterval,
        });
        this.setupAuthMiddleware();
        this.setupEventHandlers();
        return this.io;
    }
    getIO() {
        if (!this.io) {
            throw new Error('Socket.io has not been initialized. Please call socketServer.init(httpServer) first.');
        }
        return this.io;
    }
    /**
     * Handshake authentication middleware checking query token, header token, or cookies.
     */
    setupAuthMiddleware() {
        if (!this.io)
            return;
        this.io.use((socket, next) => {
            try {
                const token = socket.handshake.auth?.token ||
                    socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                    socket.handshake.query?.token;
                if (token && typeof token === 'string') {
                    const decoded = jsonwebtoken_1.default.verify(token, envConfig_1.dotEnvConfig.ACCESS_TOKEN_SECRET);
                    socket.user = {
                        id: decoded.id || decoded.userId || decoded.sub,
                        role: decoded.role,
                        hostelId: decoded.hostelId,
                        email: decoded.email,
                    };
                }
                // Allow unauthenticated connections for public broadcasts, but with unassigned socket.user
                next();
            }
            catch (err) {
                console.warn(`[Socket.io Auth] Authentication warning: ${err.message}`);
                // Proceed without attaching socket.user
                next();
            }
        });
    }
    /**
     * Connection and room management
     */
    setupEventHandlers() {
        if (!this.io)
            return;
        this.io.on(queue_constants_1.SocketEvent.CONNECT, (socket) => {
            console.log(`🔌 Client connected: ${socket.id} (User: ${socket.user?.id || 'guest'})`);
            // Automatically join user and role specific rooms if authenticated
            if (socket.user) {
                // Direct user room: 'user:<userId>'
                socket.join(`user:${socket.user.id}`);
                // Role room: 'role:<role>' (e.g. 'role:ADMIN', 'role:OWNER', 'role:RESIDENT')
                if (socket.user.role) {
                    socket.join(`role:${socket.user.role.toUpperCase()}`);
                }
                // Hostel room: 'hostel:<hostelId>'
                if (socket.user.hostelId) {
                    socket.join(`hostel:${socket.user.hostelId}`);
                }
            }
            // Explicit room join handler (e.g. for rooms, channels)
            socket.on('join_room', (room) => {
                socket.join(room);
                console.log(`Socket ${socket.id} joined room: ${room}`);
            });
            socket.on('leave_room', (room) => {
                socket.leave(room);
                console.log(`Socket ${socket.id} left room: ${room}`);
            });
            socket.on(queue_constants_1.SocketEvent.DISCONNECT, (reason) => {
                console.log(`🔌 Client disconnected: ${socket.id}. Reason: ${reason}`);
            });
        });
    }
    /**
     * Helper Methods for Scoped Emits Across the Application
     */
    toUser(userId, event, data) {
        if (!this.io)
            return;
        this.getIO().to(`user:${userId}`).emit(event, data);
    }
    toHostel(hostelId, event, data) {
        if (!this.io)
            return;
        this.getIO().to(`hostel:${hostelId}`).emit(event, data);
    }
    toRole(role, event, data) {
        if (!this.io)
            return;
        this.getIO().to(`role:${role.toUpperCase()}`).emit(event, data);
    }
    toRoom(room, event, data) {
        if (!this.io)
            return;
        this.getIO().to(room).emit(event, data);
    }
    /**
     * Force-disconnect every socket in the user's room (production logout).
     * Emits first (handled by caller), then disconnects so other devices die
     * instantly. Never throws — safe when io is not initialised (tests).
     */
    async disconnectUser(userId) {
        if (!this.io)
            return 0;
        try {
            const sockets = await this.getIO().in(`user:${userId}`).fetchSockets();
            let n = 0;
            for (const s of sockets) {
                try {
                    s.disconnect(true);
                    n++;
                }
                catch {
                    continue;
                }
            }
            return n;
        }
        catch {
            return 0;
        }
    }
    broadcast(event, data) {
        if (!this.io)
            return;
        this.getIO().emit(event, data);
    }
    async close() {
        try {
            await this.io?.close();
        }
        finally {
            this.io = null;
        }
    }
}
exports.socketServer = new SocketService();
