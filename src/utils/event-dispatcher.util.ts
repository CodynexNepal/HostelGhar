// ──────────────────────────────────────────────────────────────────────────────
// FILE: event-dispatcher.ts
// PURPOSE: Unified Application Event Dispatcher bridging internal events,
//          BullMQ job queues, and real-time Socket.io broadcasts.
// ──────────────────────────────────────────────────────────────────────────────

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { emailQueue, notificationQueue, auditLogQueue } from '../queue/queue.factory';
import { redisClient } from '../configs/redis.config';
import { JobType, QueueName } from '../constant/queue.constants';
import { socketServer } from '../socket/socket.server';
import { logger } from '../observability/logger';
import { dotEnvConfig } from '../configs/envConfig';

export interface AppDomainEvent<T = any> {
  type: string;
  payload: T;
  userId?: string;
  hostelId?: string;
  role?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

let cachedWorkerCheck: { hasWorkers: boolean; timestamp: number } | null = null;
const WORKER_CHECK_TTL_MS = 30000;

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
    if (dotEnvConfig.ENABLE_REDIS && redisClient.status === 'ready') {
      try {
        await Promise.race([
          auditLogQueue.add(JobType.LOG_USER_ACTIVITY, {
            userId: event.userId,
            action: event.type,
            resource: event.hostelId ? `hostel:${event.hostelId}` : 'system',
            metadata: event.metadata,
            timestamp: timestampedEvent.timestamp.toISOString(),
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Audit log queue timed out')), 2000).unref(),
          ),
        ]);
      } catch (err: any) {
        logger.warn('Failed to enqueue audit log activity', { error: err?.message || String(err) });
      }
    }
  }

  /**
   * Helper to dispatch email job to BullMQ queue with bounded timeout,
   * with automatic reliable direct SMTP fallback when Redis queue is unreachable
   * or when no active workers are available to process the queue.
   */
  public async queueEmail(
    jobType: JobType,
    data: {
      to: string;
      subject: string;
      body?: string;
      html?: string;
      context?: Record<string, any>;
    },
    options?: { timeoutMs?: number; fallbackToDirectSmtp?: boolean },
  ) {
    const correlationId = data.context?.correlationId || crypto.randomUUID();
    const recipientDomain = data.to.split('@')[1] || 'unknown';

    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    const isPassenger =
      typeof (global as any).PhusionPassenger !== 'undefined' ||
      typeof process.env.PASSENGER_APP_ENV !== 'undefined' ||
      typeof process.env.PASSENGER_SPAWN_METHOD !== 'undefined' ||
      process.env.PASSENGER_MODE === 'true';
    const isDirectSmtpMode =
      !isTest &&
      (dotEnvConfig.USE_DIRECT_SMTP ||
        !dotEnvConfig.ENABLE_REDIS ||
        (isPassenger && process.env.ENABLE_WORKERS !== 'true') ||
        redisClient.status !== 'ready');

    // 1. Direct SMTP Mode: on cPanel, shared hosting without Redis, or disconnected Redis
    if (
      (isDirectSmtpMode || redisClient.status !== 'ready') &&
      options?.fallbackToDirectSmtp !== false
    ) {
      logger.info(
        'Dispatching email via direct SMTP (cPanel/direct-SMTP mode without BullMQ Redis)',
        {
          correlationId,
          queue: QueueName.EMAIL,
          jobType,
          recipientDomain,
        },
      );
      const { emailSenderService } = await import('../services/email/email-sender.service');
      await emailSenderService.send(
        {
          to: data.to,
          subject: data.subject,
          body: data.body || '',
          ...(data.html ? { html: data.html } : {}),
        },
        { correlationId },
      );
      return { id: 'direct-smtp-fallback', name: jobType, data } as any;
    }

    // 2. Check if active BullMQ workers are currently subscribed to the email queue.
    // If no workers exist (e.g. on cPanel Passenger where background workers are not spawned),
    // enqueuing to Redis would strand the job indefinitely. Dispatch via direct SMTP immediately.
    let hasActiveWorkers = false;

    if (
      !isTest &&
      cachedWorkerCheck &&
      Date.now() - cachedWorkerCheck.timestamp < WORKER_CHECK_TTL_MS
    ) {
      hasActiveWorkers = cachedWorkerCheck.hasWorkers;
    } else if (typeof (emailQueue as any).getWorkers === 'function') {
      try {
        const workers = await Promise.race([
          emailQueue.getWorkers(),
          new Promise<any[]>((_, reject) =>
            setTimeout(() => reject(new Error('Worker check timed out')), 2500).unref(),
          ),
        ]);
        hasActiveWorkers = Array.isArray(workers) && workers.length > 0;
        if (!isTest) {
          cachedWorkerCheck = { hasWorkers: hasActiveWorkers, timestamp: Date.now() };
        }
      } catch {
        hasActiveWorkers = false;
      }
    } else {
      hasActiveWorkers = true;
    }

    if (!hasActiveWorkers && options?.fallbackToDirectSmtp !== false) {
      logger.warn(
        'No active BullMQ workers listening on email queue; dispatching via direct SMTP fallback',
        {
          correlationId,
          queue: QueueName.EMAIL,
          jobType,
          recipientDomain,
        },
      );
      const { emailSenderService } = await import('../services/email/email-sender.service');
      await emailSenderService.send(
        {
          to: data.to,
          subject: data.subject,
          body: data.body || '',
          ...(data.html ? { html: data.html } : {}),
        },
        { correlationId },
      );
      return { id: 'direct-smtp-fallback', name: jobType, data } as any;
    }

    // 3. Dispatch to BullMQ queue with bounded confirmation timeout
    const timeoutMs = options?.timeoutMs ?? 2500;
    try {
      const job = await Promise.race([
        emailQueue.add(jobType, data),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Queue job confirmation timed out after ${timeoutMs}ms`)),
            timeoutMs,
          ).unref(),
        ),
      ]);

      logger.info('BullMQ email job enqueued successfully', {
        correlationId,
        jobId: job.id,
        queue: QueueName.EMAIL,
        jobType,
        queueState: 'waiting',
        recipientDomain,
      });

      return job;
    } catch (err: any) {
      if (options?.fallbackToDirectSmtp !== false) {
        // Direct SMTP delivery fallback ensures critical user emails from info@hostelghar.com
        // are reliably delivered immediately even when Redis port is blocked or queue times out
        logger.warn('BullMQ enqueue failed or timed out; attempting direct SMTP fallback', {
          correlationId,
          queue: QueueName.EMAIL,
          jobType,
          error: err?.message || String(err),
          recipientDomain,
        });
        const { emailSenderService } = await import('../services/email/email-sender.service');
        await emailSenderService.send(
          {
            to: data.to,
            subject: data.subject,
            body: data.body || '',
            ...(data.html ? { html: data.html } : {}),
          },
          { correlationId },
        );
        return { id: 'direct-smtp-fallback', name: jobType, data } as any;
      }
      throw err;
    }
  }

  /**
   * Helper to dispatch bulk email jobs to BullMQ queue in a single operation
   */
  public async queueEmailsBulk(
    jobs: Array<{
      name: JobType;
      data: {
        to: string;
        subject: string;
        body?: string;
        html?: string;
        context?: Record<string, any>;
      };
    }>,
    options?: { timeoutMs?: number },
  ) {
    if (jobs.length === 0) return [];

    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    const isPassenger =
      typeof (global as any).PhusionPassenger !== 'undefined' ||
      typeof process.env.PASSENGER_APP_ENV !== 'undefined' ||
      typeof process.env.PASSENGER_SPAWN_METHOD !== 'undefined' ||
      process.env.PASSENGER_MODE === 'true';
    const isDirectSmtpMode =
      !isTest &&
      (dotEnvConfig.USE_DIRECT_SMTP ||
        !dotEnvConfig.ENABLE_REDIS ||
        (isPassenger && process.env.ENABLE_WORKERS !== 'true') ||
        redisClient.status !== 'ready');

    if (isDirectSmtpMode) {
      const { emailSenderService } = await import('../services/email/email-sender.service');
      await Promise.allSettled(
        jobs.map((job) =>
          emailSenderService.send(
            {
              to: job.data.to,
              subject: job.data.subject,
              body: job.data.body || '',
              ...(job.data.html ? { html: job.data.html } : {}),
            },
            { correlationId: job.data.context?.correlationId },
          ),
        ),
      );
      return jobs.map((j, i) => ({ id: `direct-bulk-${i}`, name: j.name, data: j.data })) as any;
    }

    // Check if active BullMQ workers are currently subscribed to the email queue.
    let hasActiveWorkers = false;
    if (
      !isTest &&
      cachedWorkerCheck &&
      Date.now() - cachedWorkerCheck.timestamp < WORKER_CHECK_TTL_MS
    ) {
      hasActiveWorkers = cachedWorkerCheck.hasWorkers;
    } else if (typeof (emailQueue as any).getWorkers === 'function') {
      try {
        const workers = await Promise.race([
          emailQueue.getWorkers(),
          new Promise<any[]>((_, reject) =>
            setTimeout(() => reject(new Error('Worker check timed out')), 2500).unref(),
          ),
        ]);
        hasActiveWorkers = Array.isArray(workers) && workers.length > 0;
        if (!isTest) {
          cachedWorkerCheck = { hasWorkers: hasActiveWorkers, timestamp: Date.now() };
        }
      } catch {
        hasActiveWorkers = false;
      }
    } else {
      hasActiveWorkers = true;
    }

    if (!hasActiveWorkers) {
      logger.warn(
        'No active BullMQ workers listening on email queue; dispatching bulk emails via direct SMTP',
        { jobCount: jobs.length },
      );
      const { emailSenderService } = await import('../services/email/email-sender.service');
      await Promise.allSettled(
        jobs.map((job) =>
          emailSenderService.send(
            {
              to: job.data.to,
              subject: job.data.subject,
              body: job.data.body || '',
              ...(job.data.html ? { html: job.data.html } : {}),
            },
            { correlationId: job.data.context?.correlationId },
          ),
        ),
      );
      return jobs.map((j, i) => ({
        id: `direct-bulk-fallback-${i}`,
        name: j.name,
        data: j.data,
      })) as any;
    }

    const timeoutMs = options?.timeoutMs ?? 5000;
    try {
      return await Promise.race([
        emailQueue.addBulk(jobs),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Bulk queue jobs confirmation timed out after ${timeoutMs}ms`)),
            timeoutMs,
          ).unref(),
        ),
      ]);
    } catch (err: any) {
      logger.warn('BullMQ bulk enqueue failed or timed out; falling back to direct SMTP delivery', {
        error: err?.message || String(err),
        jobCount: jobs.length,
      });
      const { emailSenderService } = await import('../services/email/email-sender.service');
      await Promise.allSettled(
        jobs.map((job) =>
          emailSenderService.send(
            {
              to: job.data.to,
              subject: job.data.subject,
              body: job.data.body || '',
              ...(job.data.html ? { html: job.data.html } : {}),
            },
            { correlationId: job.data.context?.correlationId },
          ),
        ),
      );
      return jobs.map((j, i) => ({
        id: `direct-bulk-err-fallback-${i}`,
        name: j.name,
        data: j.data,
      })) as any;
    }
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
    try {
      if (redisClient.status !== 'ready' && !dotEnvConfig.ENABLE_REDIS) {
        if (data.userId) {
          socketServer.toUser(data.userId, data.type, data);
        } else if (data.hostelId) {
          socketServer.toHostel(data.hostelId, data.type, data);
        }
        return { id: 'direct-socket-fallback' } as any;
      }
      return await notificationQueue.add(JobType.SEND_IN_APP_NOTIFICATION, data);
    } catch (err: any) {
      logger.warn('[EventDispatcher] Notification queue failed; falling back to direct socket', {
        error: err?.message || String(err),
      });
      if (data.userId) {
        socketServer.toUser(data.userId, data.type, data);
      } else if (data.hostelId) {
        socketServer.toHostel(data.hostelId, data.type, data);
      }
      return { id: 'direct-socket-fallback' } as any;
    }
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
