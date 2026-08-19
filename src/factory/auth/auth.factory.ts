import { UserRepository } from '../../repository/auth/user.repository';
import { AuthController } from '../../controller/auth/auth.controller';
import { AuthService } from '../../services/auth/auth.services';

export class AuthFactory {
  private constructor() {}

  public static create(): AuthController {
    const userRepository = new UserRepository();

    const authService = new AuthService(userRepository);

    return new AuthController(authService);
  }
}
