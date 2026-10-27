"use strict";
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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterUserDto = void 0;
// `IsEmail` validates RFC 5322 email format.
// `IsString` ensures the value is a string (not a number, array, etc.).
// `MinLength` / `MaxLength` enforce length constraints.
// `IsNotEmpty` rejects empty strings after trimming.
// `Matches` applies a custom regex pattern.
const class_validator_1 = require("class-validator");
// ─── RegisterUserDto Class ──────────────────────────────────────────────────
class RegisterUserDto {
}
exports.RegisterUserDto = RegisterUserDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'First name is required' })
    // `@IsString()` guards against type-confusion attacks where an attacker
    // sends `{ "firstName": 123 }` — the string check catches this.
    ,
    (0, class_validator_1.IsString)({ message: 'First name must be a string' })
    // `@MinLength(2)` prevents single-character names that are almost
    // certainly typos or test data.
    ,
    (0, class_validator_1.MinLength)(2, { message: 'First name must be at least 2 characters long' })
    // `@MaxLength(100)` prevents absurdly long names that could cause
    // layout issues in the UI or exceed the database column length.
    ,
    (0, class_validator_1.MaxLength)(100, { message: 'First name must not exceed 100 characters' }),
    __metadata("design:type", String)
], RegisterUserDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Last name is required' }),
    (0, class_validator_1.IsString)({ message: 'Last name must be a string' }),
    (0, class_validator_1.MinLength)(2, { message: 'Last name must be at least 2 characters long' }),
    (0, class_validator_1.MaxLength)(100, { message: 'Last name must not exceed 100 characters' }),
    __metadata("design:type", String)
], RegisterUserDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Email is required' })
    // `@IsEmail()` validates email format using a battle-tested regex.
    // This prevents obviously invalid emails from reaching the database,
    // avoiding wasted resources on email verification attempts.
    ,
    (0, class_validator_1.IsEmail)({}, { message: 'Please provide a valid email address' }),
    __metadata("design:type", String)
], RegisterUserDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Password is required' })
    // `@IsString()` prevents type-confusion (e.g., `{ "password": true }`).
    ,
    (0, class_validator_1.IsString)({ message: 'Password must be a string' })
    // `@MinLength(8)` enforces NIST SP 800-63B minimum password length.
    // Shorter passwords are trivially brute-forced even with bcrypt.
    ,
    (0, class_validator_1.MinLength)(8, { message: 'Password must be at least 8 characters long' })
    // `@MaxLength(128)` prevents denial-of-service via extremely long
    // passwords — bcrypt is deliberately slow, and a 10MB password string
    // could freeze the server for minutes.
    ,
    (0, class_validator_1.MaxLength)(128, { message: 'Password must not exceed 128 characters' })
    // `@Matches()` enforces password complexity: at least one uppercase
    // letter, one lowercase letter, one digit, and one special character.
    // This dramatically increases the keyspace attackers must search.
    ,
    (0, class_validator_1.Matches)(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
    }),
    __metadata("design:type", String)
], RegisterUserDto.prototype, "password", void 0);
