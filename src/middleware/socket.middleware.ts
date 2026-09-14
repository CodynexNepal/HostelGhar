// ──────────────────────────────────────────────────────────────────────────────
// FILE: socket.middleware.ts
// PURPOSE: Middleware that decorates every incoming Express request with Socket.io
//          broadcasting helpers, allowing ALL endpoints to emit real-time updates.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import { socketServer } from '../socket/socket.server';

// Extend Express Request interface globally
declare global {
  namespace Express {
    interface Request {
      io: Server;
      notifyUser: (userId: string, event: string, data: any) => void;
      notifyHostel: (hostelId: string, event: string, data: any) => void;
      notifyRole: (role: string, event: string, data: any) => void;
      notifyRoom: (room: string, event: string, data: any) => void;
      broadcastEvent: (event: string, data: any) => void;
    }
  }
}

/**
 * Express middleware to inject socket helpers into req object on all routes
 */
export const socketContextMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const noop = (): void => {
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
    const io = socketServer.getIO();
    req.io = io;
    req.notifyUser = (userId: string, event: string, data: any) =>
      socketServer.toUser(userId, event, data);
    req.notifyHostel = (hostelId: string, event: string, data: any) =>
      socketServer.toHostel(hostelId, event, data);
    req.notifyRole = (role: string, event: string, data: any) =>
      socketServer.toRole(role, event, data);
    req.notifyRoom = (room: string, event: string, data: any) =>
      socketServer.toRoom(room, event, data);
    req.broadcastEvent = (event: string, data: any) => socketServer.broadcast(event, data);
  } catch (err: any) {
    // If socket server isn't initialized yet, keep the no-op fallbacks above.
    console.warn(`[SocketMiddleware] Socket server not available: ${err.message}`);
  }
  next();
};
