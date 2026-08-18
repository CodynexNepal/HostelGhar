export type SafeUserResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: SafeUserResponse;
};

export type ILoginResult = AuthResult;
export type IRegisterResult = AuthResult;
