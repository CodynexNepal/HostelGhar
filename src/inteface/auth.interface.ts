// ──────────────────────────────────────────────────────────────────────────────
// FILE: auth.interface.ts
// PURPOSE: Interface contracts for authentication payloads and responses.
// ──────────────────────────────────────────────────────────────────────────────

export interface ISafeUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface IAuthResult {
  accessToken: string;
  refreshToken: string;
  user: ISafeUserResponse;
}

export interface ITokenPayload {
  userId: string;
  email: string;
  role: string;
}
export type ILoginResult = IAuthResult;
export type IRegisterResult = IAuthResult;
