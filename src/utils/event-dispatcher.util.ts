// ──────────────────────────────────────────────────────────────────────────────
// FILE: event-dispatcher.ts
// PURPOSE: Unified Application Event Dispatcher bridging internal events,
//          BullMQ job queues, and real-time Socket.io broadcasts.
// ──────────────────────────────────────────────────────────────────────────────

import { EventEmitter } from 'events';
import { emailQueue, notificationQueue, auditLogQueue } from '../queue/queue.factory';
import { JobType, SocketEvent } from '../constant/queue.constants';
import { socketServer } from '../socket/socket.server';

export interface AppDomainEvent<T = any> {
  type: string;
  payload: T;
  userId?: string;
  hostelId?: string;
  role?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

class AppEventDispatcher extends EventEmitter {
  constructor() {
    super();
    this.setupInternalHandlers();
  }

  /**
   * Dispatches a domain event asynchronously across BullMQ queues and real-time sockets
   */
  public async dispatch<T>(event: AppDomainEvent<T>): Promise<void> {
    const timestampedEvent = {
      ...event,
      timestamp: event.timestamp || new Date(),
    };

    // 1. Emit locally via Node EventEmitter
    this.emit(event.type, timestampedEvent);

    // 2. Broadcast via Socket.io to target recipients
    this.broadcastRealtime(timestampedEvent);

    // 3. Queue asynchronous audit logging
    await auditLogQueue.add(JobType.LOG_USER_ACTIVITY, {
      userId: event.userId,
      action: event.type,
      resource: event.hostelId ? `hostel:${event.hostelId}` : 'system',
      metadata: event.metadata,
      timestamp: timestampedEvent.timestamp.toISOString(),
    });
  }

  /**
   * Helper to dispatch email job to BullMQ queue
   */
  public async queueEmail(
    jobType: JobType,
    data: { to: string; subject: string; body?: string; context?: Record<string, any> },
  ) {
    return await emailQueue.add(jobType, data);
  }

  /**
   * Helper to dispatch push/in-app notification to BullMQ queue
   */
  public async queueNotification(data: {
    userId?: string;
    hostelId?: string;
    role?: string;
    title: string;
    message: string;
    type: string;
    data?: Record<string, any>;
  }) {
    return await notificationQueue.add(JobType.SEND_IN_APP_NOTIFICATION, data);
  }

  private broadcastRealtime(event: AppDomainEvent): void {
    try {
      if (event.userId) {
        socketServer.toUser(event.userId, event.type, event.payload);
      } else if (event.hostelId) {
        socketServer.toHostel(event.hostelId, event.type, event.payload);
      } else if (event.role) {
        socketServer.toRole(event.role, event.type, event.payload);
      } else {
        socketServer.broadcast(event.type, event.payload);
      }
    } catch (err: any) {
      console.warn(`[EventDispatcher] Real-time broadcast failed: ${err.message}`);
    }
  }

  private setupInternalHandlers(): void {
    // Example listener: when user registers, trigger welcome email
    this.on('USER_REGISTERED', async (event: AppDomainEvent) => {
      if (event.payload?.email) {
        await this.queueEmail(JobType.SEND_WELCOME_EMAIL, {
          to: event.payload.email,
          subject: 'Welcome to HostelGhar!',
          body: `Hi ${event.payload.firstName || 'User'}, welcome to HostelGhar platform.`,
        });
      }
    });
  }
}

export const eventDispatcher = new AppEventDispatcher();
