// ──────────────────────────────────────────────────────────────────────────────
// FILE: socket.server.ts
// PURPOSE: Enterprise Socket.io server instance with Redis Adapter for horizontal
//          scaling, JWT handshake authentication, room joins, and scoped emits.
// ──────────────────────────────────────────────────────────────────────────────

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { createRedisClient } from '../configs/redis.config';
import { dotEnvConfig } from '../configs/envConfig';
import { socketConfig } from '../configs/socket.config';
import { SocketEvent } from '../constant/queue.constants';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
    hostelId?: string;
    email?: string;
  };
}

class SocketService {
  private io: Server | null = null;
  private pubClient: import('ioredis').default | null = null;
  private subClient: import('ioredis').default | null = null;

  public init(httpServer: HttpServer): Server {
    const isPassenger =
      typeof (global as any).PhusionPassenger !== 'undefined' ||
      process.env.PASSENGER_MODE === 'true';
    const isRedisDisabled =
      !dotEnvConfig.ENABLE_REDIS ||
      dotEnvConfig.USE_DIRECT_SMTP ||
      (isPassenger && process.env.ENABLE_WORKERS !== 'true');

    let redisAdapter: any = undefined;
    if (!isRedisDisabled) {
      try {
        if (!this.pubClient || this.pubClient.status === 'end') {
          this.pubClient = createRedisClient('socket-pub');
        }
        if (!this.subClient || this.subClient.status === 'end') {
          this.subClient = createRedisClient('socket-sub');
        }
        redisAdapter = createAdapter(this.pubClient, this.subClient);
        console.log('⚡ Socket.io Server initialized with Redis Adapter');
      } catch {
        console.warn('⚡ Redis adapter unavailable; falling back to in-memory Socket.io adapter');
      }
    } else {
      console.log(
        '⚡ Socket.io Server initialized with in-memory adapter (cPanel / standalone mode)',
      );
    }

    this.io = new Server(httpServer, {
      cors: socketConfig.cors,
      ...(redisAdapter ? { adapter: redisAdapter } : {}),
      transports: socketConfig.transports,
      pingTimeout: socketConfig.pingTimeout,
      pingInterval: socketConfig.pingInterval,
    });

    this.setupAuthMiddleware();
    this.setupEventHandlers();

    return this.io;
  }

  public getIO(): Server {
    if (!this.io) {
      throw new Error(
        'Socket.io has not been initialized. Please call socketServer.init(httpServer) first.',
      );
    }
    return this.io;
  }

  /**
   * Handshake authentication middleware checking query token, header token, or cookies.
   */
  private setupAuthMiddleware(): void {
    if (!this.io) return;

    this.io.use((socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
          socket.handshake.query?.token;

        if (token && typeof token === 'string') {
          const decoded = jwt.verify(token, dotEnvConfig.ACCESS_TOKEN_SECRET) as any;
          socket.user = {
            id: decoded.id || decoded.userId || decoded.sub,
            role: decoded.role,
            hostelId: decoded.hostelId,
            email: decoded.email,
          };
        }
        // Allow unauthenticated connections for public broadcasts, but with unassigned socket.user
        next();
      } catch (err: any) {
        console.warn(`[Socket.io Auth] Authentication warning: ${err.message}`);
        // Proceed without attaching socket.user
        next();
      }
    });
  }

  /**
   * Connection and room management
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on(SocketEvent.CONNECT, (socket: AuthenticatedSocket) => {
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
      socket.on('join_room', (room: string) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
      });

      socket.on('leave_room', (room: string) => {
        socket.leave(room);
        console.log(`Socket ${socket.id} left room: ${room}`);
      });

      socket.on(SocketEvent.DISCONNECT, (reason) => {
        console.log(`🔌 Client disconnected: ${socket.id}. Reason: ${reason}`);
      });
    });
  }

  /**
   * Helper Methods for Scoped Emits Across the Application
   */
  public toUser(userId: string, event: string, data: any): void {
    this.getIO().to(`user:${userId}`).emit(event, data);
  }

  public toHostel(hostelId: string, event: string, data: any): void {
    this.getIO().to(`hostel:${hostelId}`).emit(event, data);
  }

  public toRole(role: string, event: string, data: any): void {
    this.getIO().to(`role:${role.toUpperCase()}`).emit(event, data);
  }

  public toRoom(room: string, event: string, data: any): void {
    this.getIO().to(room).emit(event, data);
  }

  /**
   * Force-disconnect every socket in the user's room (production logout).
   * Emits first (handled by caller), then disconnects so other devices die
   * instantly. Never throws — safe when io is not initialised (tests).
   */
  public async disconnectUser(userId: string): Promise<number> {
    try {
      const sockets = await this.getIO().in(`user:${userId}`).fetchSockets();
      let n = 0;
      for (const s of sockets) {
        try {
          s.disconnect(true);
          n++;
        } catch {
          continue;
        }
      }
      return n;
    } catch {
      return 0;
    }
  }

  public broadcast(event: string, data: any): void {
    this.getIO().emit(event, data);
  }

  public async close(): Promise<void> {
    try {
      await this.io?.close();
    } finally {
      this.io = null;
    }
  }
}

export const socketServer = new SocketService();
