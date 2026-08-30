// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.worker.ts
// PURPOSE: Background worker processing push/in-app notifications and streaming
//          live alerts directly to connected users via Socket.io / Redis PubSub.
// ──────────────────────────────────────────────────────────────────────────────

import { Job } from 'bullmq';
import { BaseWorker } from './base.worker';
import { QueueName, SocketEvent } from '../constant/queue.constants';
import { socketServer } from '../socket/socket.server';

export interface NotificationJobPayload {
  userId?: string;
  hostelId?: string;
  role?: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, any>;
}

export class NotificationWorker extends BaseWorker<NotificationJobPayload> {
  constructor() {
    super(QueueName.NOTIFICATION, 10);
  }

  async process(job: Job<NotificationJobPayload>): Promise<any> {
    const payload = job.data;

    // Real-time dispatch to Socket.io clients
    if (payload.userId) {
      socketServer.toUser(payload.userId, SocketEvent.NOTIFICATION_RECEIVED, payload);
    } else if (payload.hostelId) {
      socketServer.toHostel(payload.hostelId, SocketEvent.NOTIFICATION_RECEIVED, payload);
    } else if (payload.role) {
      socketServer.toRole(payload.role, SocketEvent.NOTIFICATION_RECEIVED, payload);
    } else {
      socketServer.broadcast(SocketEvent.NOTIFICATION_RECEIVED, payload);
    }

    return { delivered: true, timestamp: new Date() };
  }
}
