import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import nodemailer from 'nodemailer';
import { cleanEnvConfig, getSanitizedEnvSummary } from '../../src/functions/env-cleaner.function';
import { EmailSenderService } from '../../src/services/email/email-sender.service';
import { maskEmail } from '../../src/utils/normalize.util';
import { smtpConfig } from '../../src/configs/smtp.config';
import { eventDispatcher } from '../../src/utils/event-dispatcher.util';
import { JobType } from '../../src/constant/queue.constants';
import { redisClient } from '../../src/configs/redis.config';
import { emailQueue } from '../../src/queue/queue.factory';
import { AuthController } from '../../src/controller/auth/auth.controller';
import { STATUS_CODE } from '../../src/constant/statusCode.interface';
import { MESSAGES } from '../../src/constant/message.interface';

describe('Production Email Delivery Pipeline & Environment Verification', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Environment Precedence & Production Safety', () => {
    it('ensures cPanel environment variables take precedence over defaults', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://cpanel_user:pass@host/db';
      process.env.ACCESS_TOKEN_SECRET = 'cpanel-access-secret-minimum-32-chars-long';
      process.env.REFRESH_TOKEN_SECRET = 'cpanel-refresh-secret-minimum-32-chars-long';
      process.env.REDIS_URL = 'redis://cpanel-redis-host:6379';
      process.env.SMTP_HOST = 'server2.bisuphost.com';
      process.env.SMTP_PORT = '465';

      const config = cleanEnvConfig();
      expect(config.NODE_ENV).toBe('production');
      expect(config.DATABASE_URL).toBe('postgresql://cpanel_user:pass@host/db');
      expect(config.REDIS_URL).toBe('redis://cpanel-redis-host:6379');
      expect(config.SMTP_HOST).toBe('server2.bisuphost.com');
      expect(config.SMTP_PORT).toBe(465);
      expect(config.SMTP_SECURE).toBe(true);
    });

    it('selects TLS/SSL correctly: port 465 -> secure: true, port 587 -> secure: false', () => {
      process.env.DATABASE_URL = 'postgresql://test:test@host/db';
      process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-minimum-32-chars-long';
      process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-minimum-32-chars-long';

      process.env.SMTP_PORT = '465';
      delete process.env.SMTP_SECURE;
      const config465 = cleanEnvConfig();
      expect(config465.SMTP_SECURE).toBe(true);

      process.env.SMTP_PORT = '587';
      delete process.env.SMTP_SECURE;
      const config587 = cleanEnvConfig();
      expect(config587.SMTP_SECURE).toBe(false);
    });

    it('redacts sensitive secrets in getSanitizedEnvSummary without exposing passwords', () => {
      process.env.DATABASE_URL = 'postgresql://user:super_secret_db_pass@host/db';
      process.env.ACCESS_TOKEN_SECRET = 'super-secret-access-token-token-32';
      process.env.REFRESH_TOKEN_SECRET = 'super-secret-refresh-token-token-32';
      process.env.SMTP_USER = 'info@hostelghar.com';
      process.env.SMTP_PASS = 'SecretSmtpPass123!';

      const config = cleanEnvConfig();
      const sanitized = getSanitizedEnvSummary(config);

      expect(sanitized.SMTP_PASS).toBe('[REDACTED_SECRET]');
      expect(sanitized.ACCESS_TOKEN_SECRET).toBe('[REDACTED_SECRET]');
      expect(sanitized.REFRESH_TOKEN_SECRET).toBe('[REDACTED_SECRET]');
      expect(sanitized.CLOUDINARY_API_SECRET).toBe('[REDACTED_SECRET]');
      expect(String(sanitized.SMTP_PASS)).not.toContain('SecretSmtpPass123!');
    });
  });

  describe('2. Recipient Redaction & Logging Privacy', () => {
    it('masks email addresses accurately to protect PII in application logs', () => {
      expect(maskEmail('dinesh.tamang1519@gmail.com')).toBe('di***9@gmail.com');
      expect(maskEmail('info@hostelghar.com')).toBe('in***o@hostelghar.com');
      expect(maskEmail('ab@example.com')).toBe('a***@example.com');
      expect(maskEmail(undefined)).toBe('[UNKNOWN_RECIPIENT]');
    });
  });

  describe('3. SMTP Transport Execution & Fallback Candidates', () => {
    it('records SMTP acceptance and message ID upon successful transmission', async () => {
      smtpConfig.enabled = true;
      smtpConfig.host = 'server2.bisuphost.com';
      smtpConfig.port = 465;
      smtpConfig.auth = { user: 'info@hostelghar.com', pass: 'secret' };

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: '<msg-id-1234@server2.bisuphost.com>',
        response: '250 OK: message queued 1xLa0n-00000000YFw-1hAv',
      });

      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const senderService = new EmailSenderService();
      const result = await senderService.send(
        {
          to: 'recipient@gmail.com',
          subject: 'Password reset',
          body: 'Reset text',
          html: '<p>Reset link</p>',
        },
        { correlationId: 'corr-unit-test-1' },
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('falls back to local cPanel candidate when primary SMTP rejects with connection error', async () => {
      smtpConfig.enabled = true;
      smtpConfig.host = 'server2.bisuphost.com';
      smtpConfig.port = 465;
      smtpConfig.auth = { user: 'info@hostelghar.com', pass: 'secret' };

      let callCount = 0;
      const mockSendMail = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const err: any = new Error('Connection refused by NAT hairpin');
          err.code = 'ECONNREFUSED';
          return Promise.reject(err);
        }
        return Promise.resolve({
          messageId: '<fallback-id@127.0.0.1>',
          response: '250 OK fallback accepted',
        });
      });

      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const senderService = new EmailSenderService();
      const result = await senderService.send(
        {
          to: 'student@gmail.com',
          subject: 'Reset',
          body: 'Reset body',
        },
        { correlationId: 'corr-hairpin' },
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    it('throws error when SMTP is not configured', async () => {
      smtpConfig.enabled = false;
      const senderService = new EmailSenderService();
      await expect(
        senderService.send({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Body',
        }),
      ).rejects.toThrow('SMTP is not configured');
    });
  });

  describe('4. Direct SMTP Fallback & Worker Absence Protection', () => {
    it('dispatches via direct SMTP fallback when Redis queue is disconnected or not ready', async () => {
      (redisClient as any).status = 'close';
      smtpConfig.enabled = true;

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: '<fallback-delivered@server2.bisuphost.com>',
        response: '250 OK delivered',
      });
      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: mockSendMail } as any);

      const result = await eventDispatcher.queueEmail(
        JobType.SEND_PASSWORD_RESET,
        {
          to: 'student@hostelghar.com',
          subject: 'Reset Password',
          body: 'Instructions',
        },
        { fallbackToDirectSmtp: true },
      );

      expect(result.id).toBe('direct-smtp-fallback');
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      (redisClient as any).status = 'ready';
    });

    it('dispatches via direct SMTP fallback when Redis is connected but zero workers are listening', async () => {
      (redisClient as any).status = 'ready';
      vi.spyOn(emailQueue as any, 'getWorkers').mockResolvedValue([]);

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: '<fallback-no-workers@hostelghar.com>',
        response: '250 OK delivered',
      });
      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: mockSendMail } as any);

      const result = await eventDispatcher.queueEmail(
        JobType.SEND_PASSWORD_RESET,
        {
          to: 'user@hostelghar.com',
          subject: 'Reset password',
          body: 'Instructions',
        },
        { fallbackToDirectSmtp: true },
      );

      expect(result.id).toBe('direct-smtp-fallback');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. Controller Generic Response & Account Enumeration Safety', () => {
    it('returns generic security message without revealing account existence or claiming premature delivery', async () => {
      const mockAuthService: any = {
        forgotPassword: vi.fn().mockResolvedValue(undefined),
      };

      const controller = new AuthController(mockAuthService);
      const req: any = {
        body: { email: 'student@hostelghar.com' },
        headers: { 'x-request-id': 'req-test-123' },
      };

      let statusCode = 0;
      let jsonBody: any = null;
      const res: any = {
        getHeader: vi.fn().mockReturnValue('req-test-123'),
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
        message: MESSAGES.RESET_EMAIL_SENT,
      });
      expect(jsonBody.message).toBe(
        'If an account with that email exists, password reset instructions have been sent.',
      );
    });
  });
});
