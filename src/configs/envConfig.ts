// ──────────────────────────────────────────────────────────────────────────────
// FILE: envConfig.ts
// PURPOSE: Centralizes ALL environment variable access into a single frozen
//          object so that the rest of the application never reads process.env
//          directly. This prevents typos, enables autocomplete, and makes it
//          trivial to validate that required variables are present at boot time.
// ──────────────────────────────────────────────────────────────────────────────

// Import the `config` function from the `dotenv` package so that values
// defined in the `.env` file are loaded into `process.env` before we read them.
import { config } from 'dotenv';
import { cleanEnvConfig, CleanEnvConfig } from '../functions/env-cleaner.function';

// Load environment files in a developer-friendly order.
// - `.env` is the base template.
// - `.env.local` should override it for local machine-specific values.
// Preserves test environment (NODE_ENV=test or VITEST) so local .env production values don't clobber test suites.
const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
const previousNodeEnv = process.env.NODE_ENV;

config({ path: '.env', override: true });
config({ path: '.env.local', override: true });

if (isTestEnv && previousNodeEnv) {
  process.env.NODE_ENV = previousNodeEnv;
}

// Clean, validate, and freeze the configuration object
export const dotEnvConfig: CleanEnvConfig = cleanEnvConfig();
