"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDto = void 0;
// `plainToInstance` converts a plain JavaScript object (req.body) into an
// instance of a class (the DTO). This is necessary because class-validator
// decorators only work on CLASS INSTANCES, not plain objects.
const class_transformer_1 = require("class-transformer");
// `validate` runs all class-validator decorators on a class instance and
// returns an array of `ValidationError` objects for any failures.
const class_validator_1 = require("class-validator");
// Import HTTP status code for the validation error response.
const statusCode_interface_1 = require("../constant/statusCode.interface");
// Import centralized messages for consistent error messaging.
const message_interface_1 = require("../constant/message.interface");
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
// Helper function to extract human-readable error messages recursively from nested validation errors
const extractValidationMessages = (error, prefix = '') => {
    const msgs = [];
    if (error.constraints) {
        for (const msg of Object.values(error.constraints)) {
            msgs.push(prefix ? `${prefix}: ${msg}` : msg);
        }
    }
    if (error.children && error.children.length > 0) {
        for (const child of error.children) {
            const childPrefix = prefix ? `${prefix}.${child.property}` : child.property;
            msgs.push(...extractValidationMessages(child, childPrefix));
        }
    }
    return msgs;
};
// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
const validateDto = (dtoClass) => {
    // Return the actual Express middleware function.
    return async (req, res, next) => {
        // ── Step 1: Transform plain object → DTO class instance ───────
        // `plainToInstance` takes the raw `req.body` (a plain JS object
        // from the JSON parser) and creates an instance of `dtoClass`.
        // Default to `{}` so empty-body POSTs validate cleanly against all-optional DTOs.
        // If client passes an array directly, wrap into { meals: [...] } for meal array DTOs.
        const rawBody = req.body ?? {};
        const payload = Array.isArray(rawBody) && dtoClass.name.toLowerCase().includes('meal')
            ? { meals: rawBody }
            : rawBody;
        const dtoInstance = (0, class_transformer_1.plainToInstance)(dtoClass, payload);
        // ── Step 2: Run all validation decorators ─────────────────────
        const errors = await (0, class_validator_1.validate)(dtoInstance, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });
        // ── Step 3: Check for validation errors ───────────────────────
        if (errors.length > 0) {
            const formattedErrors = errors.map((error) => {
                const directMessages = error.constraints ? Object.values(error.constraints) : [];
                const messages = directMessages.length > 0 ? directMessages : extractValidationMessages(error);
                return {
                    field: error.property,
                    messages: messages.length > 0 ? messages : ['Validation failed'],
                };
            });
            res.status(statusCode_interface_1.STATUS_CODE.VALIDATION_ERROR).json({
                success: false,
                message: message_interface_1.MESSAGES.VALIDATION_ERROR,
                errors: formattedErrors,
            });
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
exports.validateDto = validateDto;
