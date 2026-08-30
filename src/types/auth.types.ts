// ──────────────────────────────────────────────────────────────────────────────
// FILE: auth.types.ts
// PURPOSE: Type aliases and utility types for auth workflows.
// ──────────────────────────────────────────────────────────────────────────────

import {
  ISafeUserResponse,
  IAuthResult,
  ITokenPayload,
  ILoginResult,
  IRegisterResult,
} from '../inteface';

export type SafeUserResponse = ISafeUserResponse;
export type AuthResult = IAuthResult;
export type TokenPayload = ITokenPayload;
export type LoginResult = ILoginResult;
export type RegisterResult = IRegisterResult;

export type { ILoginResult, IRegisterResult };
