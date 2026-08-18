// ──────────────────────────────────────────────────────────────────────────────
// FILE: validate-dto.middleware.ts
// PURPOSE: A reusable Express middleware that validates request bodies against
//          DTO (Data Transfer Object) classes decorated with class-validator
//          rules. This middleware runs BEFORE the controller, ensuring that
//          by the time the controller executes, `req.body` is guaranteed to
//          be valid.
//
// WHY MIDDLEWARE INSTEAD OF INLINE VALIDATION?
//   1. DRY — validation logic is written ONCE and applied to any route.
//   2. Separation of Concerns — controllers stay thin and focused on HTTP.
//   3. Consistent error format — every validation failure returns the same
//      structured error response, making client-side error handling uniform.
//
// OOP PRINCIPLES:
//   • Abstraction — the route doesn't know HOW validation works; it just
//     declares WHICH DTO to validate against.
//   • Open/Closed — adding validation to a new endpoint means passing a
//     different DTO class, not modifying this middleware.
// ──────────────────────────────────────────────────────────────────────────────

// Import Express types for the middleware signature.
import { Request, Response, NextFunction } from 'express';

// `plainToInstance` converts a plain JavaScript object (req.body) into an
// instance of a class (the DTO). This is necessary because class-validator
// decorators only work on CLASS INSTANCES, not plain objects.
import { plainToInstance } from 'class-transformer';

// `validate` runs all class-validator decorators on a class instance and
// returns an array of `ValidationError` objects for any failures.
import { validate, ValidationError } from 'class-validator';

// Import HTTP status code for the validation error response.
import { STATUS_CODE } from '../constant/statusCode.interface';

// Import centralized messages for consistent error messaging.
import { MESSAGES } from '../constant/message.interface';

// ─── validateDto() Factory Function ─────────────────────────────────────────

// This is a FACTORY FUNCTION — it takes a DTO class and RETURNS a middleware
// function. This pattern allows us to parameterize the middleware:
//
//   router.post('/register', validateDto(RegisterUserDto), controller.register)
//   router.post('/login', validateDto(LoginUserDto), controller.login)
//
// Each route gets its own validation middleware configured for the right DTO.
//
// The generic type parameter `T` represents the DTO class type.
// `new (...args: unknown[]) => T` is a TypeScript "constructor type" — it
// means "any class that can be instantiated with `new`". This ensures we
// can only pass actual classes (not interfaces or plain objects).

// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
export const validateDto = <T extends Object>(dtoClass: new (...args: unknown[]) => T) => {
  // Return the actual Express middleware function.
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // ── Step 1: Transform plain object → DTO class instance ───────

    // `plainToInstance` takes the raw `req.body` (a plain JS object
    // from the JSON parser) and creates an instance of `dtoClass`.
    // Without this step, the class-validator decorators have nothing
    // to validate against — they're attached to class properties,
    // and a plain object has no class.
    const dtoInstance = plainToInstance(dtoClass, req.body);

    // ── Step 2: Run all validation decorators ─────────────────────

    // `validate()` checks every @IsEmail, @MinLength, @IsNotEmpty, etc.
    // decorator on the DTO instance. It returns an array of
    // ValidationError objects — one for each failed rule.
    //
    // `whitelist: true` strips any properties NOT defined in the DTO.
    // This prevents "mass assignment" attacks where an attacker sends
    // `{ "email": "...", "password": "...", "role": "admin" }` to
    // escalate privileges. The `role` field would be silently removed.
    //
    // `forbidNonWhitelisted: true` goes further — instead of silently
    // stripping unknown properties, it REJECTS the request entirely.
    // This makes the API strict and predictable.
    const errors: ValidationError[] = await validate(dtoInstance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    // ── Step 3: Check for validation errors ───────────────────────

    // If there are validation errors, return them immediately.
    // Do NOT call `next()` — the request stops here.
    if (errors.length > 0) {
      // Map each ValidationError to a human-readable error object.
      // `constraints` is a Record<string, string> where the key is
      // the validator name (e.g., 'isEmail') and the value is the
      // error message (e.g., 'Please provide a valid email address').
      const formattedErrors = errors.map((error: ValidationError) => ({
        // The field name that failed validation (e.g., 'email').
        field: error.property,

        // All error messages for this field. A single field can have
        // multiple violations (e.g., both @IsNotEmpty and @IsEmail fail
        // for an empty email field).
        messages: error.constraints ? Object.values(error.constraints) : [],
      }));

      // Return HTTP 422 Unprocessable Entity — the standard status code
      // for "the server understands the content type and syntax, but
      // the data is semantically invalid".
      res.status(STATUS_CODE.VALIDATION_ERROR).json({
        success: false,
        message: MESSAGES.VALIDATION_ERROR,
        errors: formattedErrors,
      });

      // Explicit return to prevent calling next() after sending response.
      return;
    }

    // ── Step 4: Validation passed — proceed to controller ─────────

    // Replace `req.body` with the validated DTO instance. This ensures
    // that the controller receives a clean, type-safe object with only
    // the whitelisted properties — no extra fields from the raw request.
    req.body = dtoInstance;

    // Call `next()` to pass control to the next middleware or the
    // route handler (controller). Without this call, the request
    // would hang indefinitely.
    next();
  };
};
