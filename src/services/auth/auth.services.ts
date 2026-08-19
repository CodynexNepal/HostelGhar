import { LoginUserDto } from '../../dto/auth/login.dto';
import { RegisterUserDto } from '../../dto/auth/register.dto';
import { UserRepository } from '../../repository/auth/user.repository';
import { MESSAGES } from '../../constant/message.interface';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { JwtTokenService, ITokenPayload } from '../../utils/jwt-token.util';
import { PasswordHasher } from '../../utils/password-hasher.util';
import { ILoginResult, IRegisterResult, SafeUserResponse } from '../../types/types';
import { createHttpError } from '../../utils/createHttpError';

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
    const user = await this.userRepository.findByEmail(dto.email);

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
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser) {
      throw createHttpError(MESSAGES.USER_ALREADY_EXISTS, STATUS_CODE.CONFLICT);
    }

    const hashedPassword = await PasswordHasher.hash(dto.password);
    const newUser = await this.userRepository.createUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: hashedPassword,
    });

    return this.issueTokensForUser(newUser);
  }
}
