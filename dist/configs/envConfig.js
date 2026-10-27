"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: envConfig.ts
// PURPOSE: Centralizes ALL environment variable access into a single frozen
//          object so that the rest of the application never reads process.env
//          directly. This prevents typos, enables autocomplete, and makes it
//          trivial to validate that required variables are present at boot time.
//
// ENVIRONMENT PRECEDENCE RULES:
// 1. In production (e.g. cPanel / CloudLinux / Phusion Passenger):
//    Environment variables injected by cPanel UI or system process.env MUST
//    take strict precedence over any file. `.env` is loaded with override: false
//    as a fallback for missing defaults only. `.env.local` is NEVER loaded.
// 2. In test (NODE_ENV=test or VITEST):
//    Test environment variables are preserved; .env / .env.local do not clobber.
// 3. In development:
//    .env.local takes precedence over .env for developer convenience, but neither
//    overrides explicitly set shell environment variables.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.dotEnvConfig = void 0;
const dotenv_1 = require("dotenv");
const env_cleaner_function_1 = require("../functions/env-cleaner.function");
const initialNodeEnv = process.env.NODE_ENV;
const isProduction = initialNodeEnv === 'production';
const isTestEnv = initialNodeEnv === 'test' || Boolean(process.env.VITEST);
const isPassengerEnv = typeof global.PhusionPassenger !== 'undefined' ||
    process.env.PASSENGER_MODE === 'true';
const previousPort = process.env.PORT;
if (isProduction) {
    // In production, cPanel environment variables take precedence.
    // Never load .env.local, and never allow .env to override process.env.
    (0, dotenv_1.config)({ path: '.env', override: false });
}
else if (isTestEnv) {
    (0, dotenv_1.config)({ path: '.env', override: false });
    (0, dotenv_1.config)({ path: '.env.local', override: false });
    if (initialNodeEnv) {
        process.env.NODE_ENV = initialNodeEnv;
    }
}
else {
    // In development, load machine-specific .env.local first, then fallback to .env
    (0, dotenv_1.config)({ path: '.env.local', override: false });
    (0, dotenv_1.config)({ path: '.env', override: false });
}
// Preserve Passenger assigned port if present
if (isPassengerEnv && previousPort) {
    process.env.PORT = previousPort;
}
// Clean, validate, and freeze the configuration object
exports.dotEnvConfig = (0, env_cleaner_function_1.cleanEnvConfig)();
