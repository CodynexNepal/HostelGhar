import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/auth/auth.services';
import { UserRepository } from '../../src/repository/auth/user.repository';
import { eventDispatcher } from '../../src/utils/event-dispatcher.util';
import { STATUS_CODE } from '../../src/constant/statusCode.interface';
import { JobType } from '../../src/constant/queue.constants';

describe('AuthService.forgotPassword Optimization & Reliability', () => {
  let authService: AuthService;
  let mockUserRepo: Partial<UserRepository>;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockUserRepo = {
      findByEmail: vi.fn(),
      setPasswordResetToken: vi.fn().mockResolvedValue(undefined),
      findByPasswordResetToken: vi.fn(),
      updatePassword: vi.fn().mockResolvedValue(undefined),
    };

    authService = new AuthService(mockUserRepo as UserRepository);
  });

  it('preserves account enumeration protection when email is not registered', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValue(null);
    const queueSpy = vi.spyOn(eventDispatcher, 'queueEmail');

    await expect(
      authService.forgotPassword({ email: 'nonexistent@example.com' }),
    ).resolves.toBeUndefined();

    expect(mockUserRepo.setPasswordResetToken).not.toHaveBeenCalled();
    expect(queueSpy).not.toHaveBeenCalled();
  });

  it('generates a secure token, updates DB, and enqueues email for registered user', async () => {
    const existingUser = {
      id: 'user-uuid-1',
      email: 'student@hostelghar.com',
      firstName: 'Aayush',
      passwordResetExpiresAt: null,
    };
    (mockUserRepo.findByEmail as any).mockResolvedValue(existingUser);
    const queueSpy = vi.spyOn(eventDispatcher, 'queueEmail').mockResolvedValue({ id: 'job-1' } as any);

    await authService.forgotPassword({ email: 'student@hostelghar.com' });

    expect(mockUserRepo.setPasswordResetToken).toHaveBeenCalledTimes(1);
    const [, tokenHash, expiresAt] = (mockUserRepo.setPasswordResetToken as any).mock.calls[0];
    expect(typeof tokenHash).toBe('string');
    expect(tokenHash).toHaveLength(64); // SHA-256 hex
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);

    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith(
      JobType.SEND_PASSWORD_RESET,
      expect.objectContaining({
        to: 'student@hostelghar.com',
        subject: expect.stringContaining('Reset your HostelGhar password'),
      }),
      expect.objectContaining({ timeoutMs: 2500, fallbackToDirectSmtp: true }),
    );
  });

  it('is idempotent on rapid retries within 2m cooldown and does not churn tokens or spam queue', async () => {
    // Token generated 30 seconds ago (14.5 minutes remaining of 15m)
    const recentExpiresAt = new Date(Date.now() + 14.5 * 60 * 1000);
    const existingUser = {
      id: 'user-uuid-2',
      email: 'student2@hostelghar.com',
      firstName: 'Bikash',
      passwordResetExpiresAt: recentExpiresAt,
    };
    (mockUserRepo.findByEmail as any).mockResolvedValue(existingUser);
    const queueSpy = vi.spyOn(eventDispatcher, 'queueEmail');

    await authService.forgotPassword({ email: 'student2@hostelghar.com' });

    // Should NOT regenerate or persist a new token
    expect(mockUserRepo.setPasswordResetToken).not.toHaveBeenCalled();
    // Should NOT send a duplicate email
    expect(queueSpy).not.toHaveBeenCalled();
  });

  it('throws controlled 503 error when queue times out or Redis fails without false success', async () => {
    const existingUser = {
      id: 'user-uuid-3',
      email: 'student3@hostelghar.com',
      firstName: 'Chirag',
      passwordResetExpiresAt: null,
    };
    (mockUserRepo.findByEmail as any).mockResolvedValue(existingUser);
    vi.spyOn(eventDispatcher, 'queueEmail').mockRejectedValue(
      new Error('Queue job confirmation timed out after 3500ms'),
    );

    await expect(authService.forgotPassword({ email: 'student3@hostelghar.com' })).rejects.toMatchObject({
      statusCode: STATUS_CODE.SERVICE_UNAVAILABLE,
      message: expect.stringContaining('Service temporarily unavailable'),
    });
  });
});
