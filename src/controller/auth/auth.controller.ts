import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../services/auth/auth.services';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CookieManager } from '../../utils/cookie-manager.util';
import { Message } from '../../constant/message.interface';
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      CookieManager.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(STATUS_CODE.CREATED).json({ message: Message.USER_CREATED_SUCCESS });
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.Login(req.body);
      CookieManager.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(STATUS_CODE.SUCCESS).json({ message: Message.LOGIN_SUCCESS });
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
      res.status(STATUS_CODE.OK).json({ message: Message.RESET_EMAIL_SENT });
    } catch (error) {
      next(error);
    }
  };

  public resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.resetPassword(req.body);
      res.status(STATUS_CODE.OK).json({ message: Message.PASSWORD_RESET_SUCCESS });
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
      res.status(STATUS_CODE.OK).json({ message: Message.PASSWORD_RESET_SUCCESS });
    } catch (error) {
      next(error);
    }
  };
}
