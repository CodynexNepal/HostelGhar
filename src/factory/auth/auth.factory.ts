import { UserRepository } from '../../repository/auth/user.repository';
import { AuthController } from '../../controller/auth/auth.controller';
import { AuthService } from '../../services/auth/auth.services';

export class AuthFactory {
  private constructor() {}

  public static AuthController(): AuthController {
    const userRepository = new UserRepository();
    const loginService = new AuthService(userRepository);
    const loginController = new AuthController(loginService);

    return loginController;
  }

  public static RegisterController(): AuthController {
    const userRepository = new UserRepository();
    const registerService = new AuthService(userRepository);
    const registerController = new AuthController(registerService);

    return registerController;
  }
}
