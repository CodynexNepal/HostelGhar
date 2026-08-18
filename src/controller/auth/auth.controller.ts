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
}
