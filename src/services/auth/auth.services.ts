import { LoginUserDto } from '../../dto/auth/login.dto';
import { RegisterUserDto } from '../../dto/auth/register.dto';
import { ForgotPasswordDto } from '../../dto/auth/forgot-password.dto';
import { ResetPasswordDto } from '../../dto/auth/reset-password.dto';
import { ChangePasswordDto } from '../../dto/auth/change-password.dto';
import { UserRepository } from '../../repository/auth/user.repository';
import { MESSAGES } from '../../constant/message.interface';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { JwtTokenService, ITokenPayload } from '../../utils/jwt-token.util';
import { PasswordHasher } from '../../utils/password-hasher.util';
import { ILoginResult, IRegisterResult, SafeUserResponse } from '../../types/types';
import { createHttpError } from '../../utils/createHttpError';
import { normalizeEmail } from '../../utils/normalize.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { dotEnvConfig } from '../../configs/envConfig';
import {
  getTokenIssuedAtMs,
  isRevokedByLogoutAll,
  isTokenBlocklisted,
  markUserLoggedOutAll,
  parseExpiryToSeconds,
} from '../../utils/token-blocklist.util';
import { JobType } from '../../constant/queue.constants';
import {
  renderPasswordChangedEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
} from '../../templates/email.template';
import crypto from 'crypto';
import { logger } from '../../observability/logger';

const toSafeUserResponse = (user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}): SafeUserResponse => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
});

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {
    this.Login = this.Login.bind(this);
    this.register = this.register.bind(this);
  }

  public async Login(dto: LoginUserDto): Promise<ILoginResult> {
    const user = await this.userRepository.findByEmail(normalizeEmail(dto.email));

    if (!user) {
      throw createHttpError(MESSAGES.INVALID_EMAIL_OR_PASSWORD, STATUS_CODE.UNAUTHORIZED);
    }

    const isPasswordValid = await PasswordHasher.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw createHttpError(MESSAGES.INVALID_EMAIL_OR_PASSWORD, STATUS_CODE.UNAUTHORIZED);
    }

    return this.issueTokensForUser(user);
  }

  private async issueTokensForUser(user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  }): Promise<ILoginResult> {
    const tokenPayload: ITokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = JwtTokenService.generateAccessToken(tokenPayload);
    const refreshToken = JwtTokenService.generateRefreshToken(tokenPayload);
    const hashedRefreshToken = await PasswordHasher.hash(refreshToken);

    await this.userRepository.updateRefreshToken(user.id, hashedRefreshToken);

    return {
      accessToken,
      refreshToken,
      user: toSafeUserResponse(user),
    };
  }

  public async register(dto: RegisterUserDto): Promise<IRegisterResult> {
    const email = normalizeEmail(dto.email);
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw createHttpError(MESSAGES.USER_ALREADY_EXISTS, STATUS_CODE.CONFLICT);
    }

    const hashedPassword = await PasswordHasher.hash(dto.password);
    const newUser = await this.userRepository.createUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      password: hashedPassword,
    });

    const welcomeTemplate = renderWelcomeEmail(newUser.firstName);
    await eventDispatcher.queueEmail(JobType.SEND_WELCOME_EMAIL, {
      to: newUser.email,
      subject: welcomeTemplate.subject,
      body: welcomeTemplate.body,
    });

    return this.issueTokensForUser(newUser);
  }

  public async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userRepository.findByEmail(normalizeEmail(dto.email));
    if (!user) {
      // Preserve account-enumeration protections: do not reveal whether account exists
      return;
    }

    // Idempotency guard: prevent duplicate emails and token churn if requested within 2m cooldown
    if (user.passwordResetExpiresAt) {
      const timeRemainingMs = user.passwordResetExpiresAt.getTime() - Date.now();
      if (timeRemainingMs > 13 * 60 * 1000) {
        logger.info('Password reset request throttled within active cooldown window', {
          userId: user.id,
          timeRemainingMs,
        });
        return;
      }
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.userRepository.setPasswordResetToken(user.id, tokenHash, expiresAt);

    const template = renderPasswordResetEmail(user.firstName, resetToken);
    try {
      await eventDispatcher.queueEmail(
        JobType.SEND_PASSWORD_RESET,
        {
          to: user.email,
          subject: template.subject,
          body: template.body,
          ...(template.html ? { html: template.html } : {}),
        },
        { timeoutMs: 2500, fallbackToDirectSmtp: true },
      );
    } catch (queueErr: any) {
      logger.error('Failed to deliver password reset email', {
        userId: user.id,
        error: queueErr?.message || String(queueErr),
      });
      throw createHttpError(
        'Service temporarily unavailable. Unable to dispatch reset email. Please try again later.',
        STATUS_CODE.SERVICE_UNAVAILABLE,
      );
    }
  }

  public async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const user = await this.userRepository.findByPasswordResetToken(tokenHash);

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw createHttpError(MESSAGES.RESET_TOKEN_INVALID, STATUS_CODE.UNAUTHORIZED);
    }

    const hashedPassword = await PasswordHasher.hash(dto.newPassword);
    await this.userRepository.updatePassword(user.id, hashedPassword);

    const template = renderPasswordChangedEmail(user.firstName);
    await eventDispatcher.queueEmail(JobType.SEND_PASSWORD_RESET, {
      to: user.email,
      subject: template.subject,
      body: template.body,
    });
  }

  public async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw createHttpError(MESSAGES.USER_NOT_FOUND, STATUS_CODE.NOT_FOUND);
    }

    const isPasswordValid = await PasswordHasher.compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw createHttpError(MESSAGES.INVALID_EMAIL_OR_PASSWORD, STATUS_CODE.UNAUTHORIZED);
    }

    const hashedPassword = await PasswordHasher.hash(dto.newPassword);
    await this.userRepository.updatePassword(user.id, hashedPassword);
    await markUserLoggedOutAll(
      user.id,
      parseExpiryToSeconds(dotEnvConfig.REFRESH_TOKEN_EXPIRY, 604800),
    );

    const template = renderPasswordChangedEmail(user.firstName);
    await eventDispatcher.queueEmail(JobType.SEND_PASSWORD_RESET, {
      to: user.email,
      subject: template.subject,
      body: template.body,
    });
  }

  /**
   * Returns the currently-authenticated user's public profile.
   * Used by the frontend (`GET /auth/me`) on app boot / after login
   * to learn the user's `role` and redirect to the correct dashboard
   * (admin | owner | resident | user) without a second login.
   */
  public async getMe(userId: string): Promise<SafeUserResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw createHttpError(MESSAGES.USER_NOT_FOUND, STATUS_CODE.NOT_FOUND);
    }
    return toSafeUserResponse(user);
  }

  /**
   * Rotates tokens from a valid refresh token. The caller passes the raw
   * refresh token (cookie or body); we compare it against the stored
   * bcrypt hash, then issue a fresh token pair.
   */
  public async refresh(refreshToken: string): Promise<ILoginResult> {
    if (await isTokenBlocklisted(refreshToken)) {
      throw createHttpError(MESSAGES.SESSION_INVALID, STATUS_CODE.UNAUTHORIZED);
    }
    const payload = JwtTokenService.verifyRefreshToken(refreshToken);
    if (!payload?.userId) {
      throw createHttpError(MESSAGES.SESSION_INVALID, STATUS_CODE.UNAUTHORIZED);
    }

    if (await isRevokedByLogoutAll(payload.userId as string, getTokenIssuedAtMs(refreshToken))) {
      throw createHttpError(MESSAGES.SESSION_INVALID, STATUS_CODE.UNAUTHORIZED);
    }

    const user = await this.userRepository.findById(payload.userId as string);
    if (!user || !user.refreshToken) {
      throw createHttpError(MESSAGES.SESSION_INVALID, STATUS_CODE.UNAUTHORIZED);
    }

    const matches = await PasswordHasher.compare(refreshToken, user.refreshToken);
    if (!matches) {
      throw createHttpError(MESSAGES.SESSION_INVALID, STATUS_CODE.UNAUTHORIZED);
    }

    return this.issueTokensForUser(user);
  }

  public async logout(userId: string): Promise<void> {
    await this.userRepository.updateRefreshToken(userId, null);
  }
}
