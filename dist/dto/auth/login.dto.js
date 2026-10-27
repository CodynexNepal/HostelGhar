"use strict";
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
exports.LoginUserDto = void 0;
// Import only the decorators needed for login — fewer constraints than
// registration because we don't enforce password complexity on login
// (the user already set a valid password during registration).
const class_validator_1 = require("class-validator");
// ─── LoginUserDto Class ─────────────────────────────────────────────────────
class LoginUserDto {
}
exports.LoginUserDto = LoginUserDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Email is required' })
    // `@IsEmail()` validates email format. On login, we still validate
    // format to avoid querying the database with garbage strings —
    // an invalid email can never match, so the query is wasted work.
    ,
    (0, class_validator_1.IsEmail)({}, { message: 'Please provide a valid email address' }),
    __metadata("design:type", String)
], LoginUserDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Password is required' })
    // `@IsString()` guards against type-confusion attacks where an attacker
    // sends a non-string value (number, boolean, object) as the password.
    ,
    (0, class_validator_1.IsString)({ message: 'Password must be a string' }),
    __metadata("design:type", String)
], LoginUserDto.prototype, "password", void 0);
