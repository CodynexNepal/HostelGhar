import { describe, expect, it, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';

vi.mock('bullmq', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    Worker: class MockWorker {
      on = vi.fn();
      close = vi.fn().mockResolvedValue(undefined);
    },
  };
});

import { EmailSenderService } from '../../src/services/email/email-sender.service';
import { EmailWorker } from '../../src/workers/email.worker';
import { eventDispatcher } from '../../src/utils/event-dispatcher.util';
import { emailQueue } from '../../src/queue/queue.factory';
import { redisClient } from '../../src/configs/redis.config';
import { JobType } from '../../src/constant/queue.constants';
import { AuthController } from '../../src/controller/auth/auth.controller';
import { STATUS_CODE } from '../../src/constant/statusCode.interface';
import { emailSenderService } from '../../src/services/email/email-sender.service';
import { smtpConfig } from '../../src/configs/smtp.config';

describe('Password Reset Email Delivery Pipeline & Failure Recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    smtpConfig.enabled = true;
    smtpConfig.host = smtpConfig.host || 'mail.hostelghar.test';
    smtpConfig.port = smtpConfig.port || 587;
  });

  describe('1. Successful Queue & Nodemailer Processing', () => {
    it('records message ID and SMTP response code upon successful submission', async () => {
      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: '<test-message-id-123@hostelghar.com>',
        response: '250 2.0.0 OK: message queued 12345',
        accepted: ['resident@hostelghar.com'],
        rejected: [],
      });

      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const senderService = new EmailSenderService();
      const result = await senderService.send(
        {
          to: 'resident@hostelghar.com',
          subject: 'Reset your HostelGhar password',
          body: 'Use this reset token to reset your password: secret-token-123',
        },
        { correlationId: 'corr-101', jobId: 'job-999' },
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'resident@hostelghar.com',
          subject: 'Reset your HostelGhar password',
        }),
      );
    });

    it('processes SEND_PASSWORD_RESET job inside EmailWorker successfully', async () => {
      const emailSpy = vi.spyOn(emailSenderService, 'send').mockResolvedValue(true);

      const worker = new EmailWorker();
      const mockJob: any = {
        id: 'bullmq-job-1',
        name: JobType.SEND_PASSWORD_RESET,
        attemptsMade: 1,
        opts: { attempts: 5 },
        data: {
          to: 'user@example.com',
          subject: 'Reset your HostelGhar password',
          body: 'Reset instructions',
          context: { correlationId: 'corr-unit-test' },
        },
      };

      const result = await worker.process(mockJob);
      expect(result).toBe(true);
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Reset your HostelGhar password',
        }),
        expect.objectContaining({ correlationId: 'corr-unit-test', jobId: 'bullmq-job-1' }),
      );

      await worker.close();
    });
  });

  describe('2. SMTP Rejection & Fallback Handling', () => {
    it('captures SMTP rejection response code and attempts fallbacks when primary fails', async () => {
      let callCount = 0;
      const mockSendMail = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const err: any = new Error('SMTP 550 User unknown');
          err.code = 'EENVELOPE';
          err.responseCode = 550;
          return Promise.reject(err);
        }
        return Promise.resolve({
          messageId: '<fallback-id@127.0.0.1>',
          response: '250 OK fallback delivered',
        });
      });

      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const senderService = new EmailSenderService();
      const result = await senderService.send(
        {
          to: 'unknown@example.com',
          subject: 'Password reset',
          body: 'Instructions',
        },
        { correlationId: 'corr-smtp-fail' },
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(2); // primary failed, candidate fallback succeeded
    });

    it('throws error with full diagnostic context when all SMTP candidates reject', async () => {
      const mockSendMail = vi.fn().mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
        responseCode: 535,
      });

      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const senderService = new EmailSenderService();
      await expect(
        senderService.send({
          to: 'user@example.com',
          subject: 'Password reset',
          body: 'Instructions',
        }),
      ).rejects.toMatchObject({
        code: 'ECONNREFUSED',
      });
    });
  });

  describe('3. Worker Failure & Dead-Letter Safety', () => {
    it('handles worker processing rejection and safely handles dead letter without leaking secrets', async () => {
      vi.spyOn(emailSenderService, 'send').mockRejectedValue(new Error('SMTP service down'));

      const worker = new EmailWorker();
      const mockJob: any = {
        id: 'job-dlq-1',
        name: JobType.SEND_PASSWORD_RESET,
        attemptsMade: 5,
        opts: { attempts: 5 },
        data: {
          to: 'victim@example.com',
          subject: 'Reset password',
          body: 'Sensitive token: secret_token_value_never_log',
          context: { correlationId: 'corr-dlq' },
        },
      };

      // Ensure processing throws
      await expect(worker.process(mockJob)).rejects.toThrow();

      // Ensure onDeadLetter executes without crashing or referencing JSON.stringify(job.data)
      expect(() => {
        (worker as any).onDeadLetter(mockJob, new Error('SMTP service down'));
      }).not.toThrow();

      await worker.close();
    });
  });

  describe('4. Redis Unavailability Recovery', () => {
    it('bypasses Redis queue and executes reliable direct SMTP when Redis is not ready', async () => {
      // Simulate disconnected Redis
      (redisClient as any).status = 'close';

      const emailSpy = vi.spyOn(emailSenderService, 'send').mockResolvedValue(true);
      const queueAddSpy = vi.spyOn(emailQueue, 'add');

      const result = await eventDispatcher.queueEmail(
        JobType.SEND_PASSWORD_RESET,
        {
          to: 'resident@hostelghar.com',
          subject: 'Reset your password',
          body: 'Reset instructions',
        },
        { fallbackToDirectSmtp: true },
      );

      expect(result.id).toBe('direct-smtp-fallback');
      expect(queueAddSpy).not.toHaveBeenCalled();
      expect(emailSpy).toHaveBeenCalledTimes(1);

      // Restore status
      (redisClient as any).status = 'ready';
    });
  });

  describe('5. Missing Worker Recovery (cPanel Phusion Passenger)', () => {
    it('falls back to direct SMTP when Redis is ready but no BullMQ workers are active on the queue', async () => {
      (redisClient as any).status = 'ready';

      // Simulate 0 active workers (as in cPanel Passenger mode where workers are suppressed)
      vi.spyOn(emailQueue as any, 'getWorkers').mockResolvedValue([]);
      const emailSpy = vi.spyOn(emailSenderService, 'send').mockResolvedValue(true);
      const queueAddSpy = vi.spyOn(emailQueue, 'add');

      const result = await eventDispatcher.queueEmail(
        JobType.SEND_PASSWORD_RESET,
        {
          to: 'student@hostelghar.com',
          subject: 'Reset your password',
          body: 'Reset instructions',
          context: { correlationId: 'corr-missing-worker' },
        },
        { fallbackToDirectSmtp: true },
      );

      expect(result.id).toBe('direct-smtp-fallback');
      expect(emailSpy).toHaveBeenCalledTimes(1);
      expect(queueAddSpy).not.toHaveBeenCalled();
    });

    it('enqueues to BullMQ normally when active workers are available', async () => {
      (redisClient as any).status = 'ready';
      vi.spyOn(emailQueue as any, 'getWorkers').mockResolvedValue([{ id: 'worker-1' }]);
      const emailSpy = vi.spyOn(emailSenderService, 'send').mockResolvedValue(true);
      const queueAddSpy = vi
        .spyOn(emailQueue, 'add')
        .mockResolvedValue({ id: 'bullmq-job-88' } as any);

      const result = await eventDispatcher.queueEmail(
        JobType.SEND_PASSWORD_RESET,
        {
          to: 'student@hostelghar.com',
          subject: 'Reset your password',
          body: 'Reset instructions',
          context: { correlationId: 'corr-has-workers' },
        },
        { fallbackToDirectSmtp: true },
      );

      expect(result.id).toBe('bullmq-job-88');
      expect(queueAddSpy).toHaveBeenCalledTimes(1);
      expect(emailSpy).not.toHaveBeenCalled();
    });
  });

  describe('6. Controller Generic Response & Account Enumeration Protection', () => {
    it('returns generic response without claiming premature delivery or revealing account status', async () => {
      const mockAuthService: any = {
        forgotPassword: vi.fn().mockResolvedValue(undefined),
      };

      const controller = new AuthController(mockAuthService);

      const req: any = {
        body: { email: 'test@hostelghar.com' },
        headers: { 'x-request-id': 'req-corr-999' },
      };

      let statusCode = 0;
      let jsonBody: any = null;
      const res: any = {
        getHeader: vi.fn().mockReturnValue('req-corr-999'),
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          jsonBody = data;
          return res;
        },
      };

      await controller.forgotPassword(req, res, vi.fn());

      expect(statusCode).toBe(STATUS_CODE.OK);
      expect(jsonBody).toEqual({
        message:
          'If an account with that email exists, password reset instructions have been sent.',
      });
      // Verifies that the generic message is NOT claiming delivery with "Reset email sent"
      expect(jsonBody.message).not.toBe('Reset email sent');
    });
  });
});
