// ──────────────────────────────────────────────────────────────────────────────
// FILE: login.dto.ts
// PURPOSE: Defines the shape and validation rules for user login input.
//          Login requires only email and password — no name fields.
//          Validating at the DTO layer ensures malformed requests are rejected
//          BEFORE any database query or password comparison runs, saving
//          server resources and preventing unnecessary bcrypt CPU usage.
//
// OOP PRINCIPLE: Abstraction — the controller doesn't need to know how
//                validation works; it just receives a validated DTO.
// ──────────────────────────────────────────────────────────────────────────────

// Import only the decorators needed for login — fewer constraints than
// registration because we don't enforce password complexity on login
// (the user already set a valid password during registration).
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

// ─── LoginUserDto Class ─────────────────────────────────────────────────────

export class LoginUserDto {
  // ─── email ──────────────────────────────────────────────────────────────

  // `@IsNotEmpty()` rejects empty string submissions — catches the case
  // where the client sends `{ "email": "" }` which `@IsEmail` might
  // not explicitly reject on all validator versions.
  @IsNotEmpty({ message: 'Email is required' })
  // `@IsEmail()` validates email format. On login, we still validate
  // format to avoid querying the database with garbage strings —
  // an invalid email can never match, so the query is wasted work.
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  // ─── password ───────────────────────────────────────────────────────────

  // `@IsNotEmpty()` ensures the password field is not blank. Without this,
  // an empty password would be passed to bcrypt.compare(), which would
  // always return false but still consume ~250ms of CPU for nothing.
  @IsNotEmpty({ message: 'Password is required' })
  // `@IsString()` guards against type-confusion attacks where an attacker
  // sends a non-string value (number, boolean, object) as the password.
  @IsString({ message: 'Password must be a string' })
  password!: string;
}
