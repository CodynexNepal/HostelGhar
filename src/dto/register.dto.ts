// ──────────────────────────────────────────────────────────────────────────────
// FILE: register.dto.ts
// PURPOSE: Defines the shape and validation rules for user registration input.
//          A DTO (Data Transfer Object) is a class that represents the data
//          flowing INTO the API. By validating here, we guarantee that the
//          service layer NEVER receives malformed or dangerous input.
//
// OOP PRINCIPLE: Abstraction — the DTO hides validation complexity from the
//                controller and service. They just receive a "known-good" object.
//
// LIBRARY: class-validator decorators perform the validation; class-transformer
//          converts the raw JSON body into an instance of this class.
// ──────────────────────────────────────────────────────────────────────────────

// `IsEmail` validates RFC 5322 email format.
// `IsString` ensures the value is a string (not a number, array, etc.).
// `MinLength` / `MaxLength` enforce length constraints.
// `IsNotEmpty` rejects empty strings after trimming.
// `Matches` applies a custom regex pattern.
import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, Matches } from 'class-validator';

// ─── RegisterUserDto Class ──────────────────────────────────────────────────

export class RegisterUserDto {
  // ─── firstName ──────────────────────────────────────────────────────────

  // `@IsNotEmpty()` rejects empty strings — prevents users from registering
  // with whitespace-only names.
  @IsNotEmpty({ message: 'First name is required' })
  // `@IsString()` guards against type-confusion attacks where an attacker
  // sends `{ "firstName": 123 }` — the string check catches this.
  @IsString({ message: 'First name must be a string' })
  // `@MinLength(2)` prevents single-character names that are almost
  // certainly typos or test data.
  @MinLength(2, { message: 'First name must be at least 2 characters long' })
  // `@MaxLength(100)` prevents absurdly long names that could cause
  // layout issues in the UI or exceed the database column length.
  @MaxLength(100, { message: 'First name must not exceed 100 characters' })
  firstName!: string;

  // ─── lastName ───────────────────────────────────────────────────────────

  // Same validation logic as firstName — consistency in data quality.
  @IsNotEmpty({ message: 'Last name is required' })
  @IsString({ message: 'Last name must be a string' })
  @MinLength(2, { message: 'Last name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Last name must not exceed 100 characters' })
  lastName!: string;

  // ─── email ──────────────────────────────────────────────────────────────

  // `@IsNotEmpty()` catches the case where email is an empty string —
  // `@IsEmail()` alone would not reject `""`.
  @IsNotEmpty({ message: 'Email is required' })
  // `@IsEmail()` validates email format using a battle-tested regex.
  // This prevents obviously invalid emails from reaching the database,
  // avoiding wasted resources on email verification attempts.
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  // ─── password ───────────────────────────────────────────────────────────

  // `@IsNotEmpty()` ensures the user didn't submit a blank password field.
  @IsNotEmpty({ message: 'Password is required' })
  // `@IsString()` prevents type-confusion (e.g., `{ "password": true }`).
  @IsString({ message: 'Password must be a string' })
  // `@MinLength(8)` enforces NIST SP 800-63B minimum password length.
  // Shorter passwords are trivially brute-forced even with bcrypt.
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  // `@MaxLength(128)` prevents denial-of-service via extremely long
  // passwords — bcrypt is deliberately slow, and a 10MB password string
  // could freeze the server for minutes.
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  // `@Matches()` enforces password complexity: at least one uppercase
  // letter, one lowercase letter, one digit, and one special character.
  // This dramatically increases the keyspace attackers must search.
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
  })
  password!: string;
}
