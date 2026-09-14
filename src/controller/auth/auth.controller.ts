import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../services/auth/auth.services';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CookieManager } from '../../utils/cookie-manager.util';
import { MESSAGES } from '../../constant/message.interface';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      CookieManager.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: MESSAGES.USER_CREATED_SUCCESS,
        data: { user: result.user },
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
        data: { user: result.user },
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
      await this.authService.forgotPassword(req.body);
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
      if (req.user?.userId) {
        await this.authService.logout(req.user.userId);
      }
      CookieManager.clearAuthCookies(res);
      res.status(STATUS_CODE.OK).json({ success: true, message: MESSAGES.LOGOUT_SUCCESS });
    } catch (error) {
      next(error);
    }
  };
}
