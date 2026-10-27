import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthService } from '../../services/auth/auth.services';
import { logoutService } from '../../services/auth/logout.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CookieManager } from '../../utils/cookie-manager.util';
import { MESSAGES } from '../../constant/message.interface';
import { logger } from '../../observability/logger';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      CookieManager.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: MESSAGES.USER_CREATED_SUCCESS,
        data: {
          user: result.user,
          token: result.accessToken,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.Login(req.body);
      CookieManager.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: MESSAGES.LOGIN_SUCCESS,
        data: {
          user: result.user,
          token: result.accessToken,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const correlationId =
        (req.headers['x-request-id'] as string) ||
        (res.getHeader('x-request-id') as string) ||
        randomUUID();

      const emailStr = typeof req.body?.email === 'string' ? req.body.email : '';
      const recipientDomain = emailStr.split('@')[1] || 'unknown';

      logger.info('Password reset request received', {
        status: 'REQUEST_RECEIVED',
        correlationId,
        recipientDomain,
      });

      await this.authService.forgotPassword(req.body, correlationId);
      res.status(STATUS_CODE.OK).json({ message: MESSAGES.RESET_EMAIL_SENT });
    } catch (error) {
      next(error);
    }
  };

  public resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.resetPassword(req.body);
      res.status(STATUS_CODE.OK).json({ message: MESSAGES.PASSWORD_RESET_SUCCESS });
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.authService.changePassword(req.user!.userId, req.body);
      CookieManager.clearAuthCookies(res);
      res.status(STATUS_CODE.OK).json({ message: MESSAGES.PASSWORD_RESET_SUCCESS });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /auth/me — returns the logged-in user's profile (id/email/role).
   * Frontend calls this on boot + right after login to decide which
   * dashboard to redirect to. Requires a valid access token
   * (Authorization: Bearer <token> OR access_token cookie).
   */
  public me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.authService.getMe(req.user!.userId);
      res.status(STATUS_CODE.OK).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawToken: string | undefined =
        req.cookies?.[CookieManager.REFRESH_TOKEN_COOKIE] ?? req.body?.refreshToken;
      if (!rawToken) {
        res.status(STATUS_CODE.UNAUTHORIZED).json({
          success: false,
          message: MESSAGES.SESSION_INVALID,
        });
        return;
      }
      const result = await this.authService.refresh(rawToken);
      CookieManager.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(STATUS_CODE.OK).json({
        success: true,
        message: MESSAGES.SUCCESS,
        data: { user: result.user },
      });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.headers.authorization;
      const bearer = header && header.startsWith('Bearer ') ? header.split(' ')[1] : undefined;
      const bodyAll = req.body?.logoutAll === true;
      const queryAll = req.query?.logoutAll === 'true' || req.query?.all === 'true';
      const result = await logoutService.logout({
        userId: req.user?.userId,
        accessToken: bearer ?? req.cookies?.[CookieManager.ACCESS_TOKEN_COOKIE],
        refreshToken: req.cookies?.[CookieManager.REFRESH_TOKEN_COOKIE] ?? req.body?.refreshToken,
        logoutAll: bodyAll || queryAll,
      });
      try {
        if (result.userId) await this.authService.logout(result.userId);
        else if (req.user?.userId) await this.authService.logout(req.user.userId);
      } catch {
        // Best effort: token/cache/socket teardown above already succeeded.
      }
      CookieManager.clearAuthCookies(res);
      res.status(STATUS_CODE.OK).json({
        success: true,
        message: result.logoutAll ? MESSAGES.SESSIONS_REVOKED : MESSAGES.LOGOUT_SUCCESS,
        data: {
          devicesRevoked: result.devicesRevoked,
          cacheKeysPurged: result.cacheKeysPurged,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public logoutAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.headers.authorization;
      const bearer = header && header.startsWith('Bearer ') ? header.split(' ')[1] : undefined;
      const result = await logoutService.logout({
        userId: req.user?.userId,
        accessToken: bearer ?? req.cookies?.[CookieManager.ACCESS_TOKEN_COOKIE],
        refreshToken: req.cookies?.[CookieManager.REFRESH_TOKEN_COOKIE] ?? req.body?.refreshToken,
        logoutAll: true,
      });
      try {
        if (result.userId) await this.authService.logout(result.userId);
      } catch {
        // Best effort.
      }
      CookieManager.clearAuthCookies(res);
      res.status(STATUS_CODE.OK).json({
        success: true,
        message: MESSAGES.SESSIONS_REVOKED,
        data: {
          devicesRevoked: result.devicesRevoked,
          cacheKeysPurged: result.cacheKeysPurged,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
