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

// Execute the loader immediately — this MUST happen before any read of
// `process.env` below, otherwise the values would be `undefined`.
config({ path: '.env' });

// Clean, validate, and freeze the configuration object
export const dotEnvConfig: CleanEnvConfig = cleanEnvConfig();
