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

// Execute the loader immediately — this MUST happen before any read of
// `process.env` below, otherwise the values would be `undefined`.
config({ path: '.env' });

// Export a single, immutable configuration object that the entire application
// imports. Every key maps 1-to-1 to an environment variable.
export const dotEnvConfig = {
  // ─── Existing App Config ────────────────────────────────────────────────────

  // The PostgreSQL connection string used by TypeORM's DataSource.
  DATABASE_URL: process.env.DATABASE_URL,

  // The port Express listens on — keeps infra config outside source code.
  PORT: process.env.PORT,

  // Redis connection URL for caching / BullMQ job queues.
  REDIS_URL: process.env.REDIS_URL,

  // Cloudinary credentials for image/file uploads.
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,

  // Runtime environment flag — defaults to 'development' when unset so that
  // local development never accidentally runs in production mode.
  NODE_ENV: process.env.NODE_ENV || 'development',

  // ─── JWT / Auth Config (NEW) ────────────────────────────────────────────────

  // Secret key used to sign ACCESS tokens. Must be a long random string.
  // Access and refresh tokens use DIFFERENT secrets so that if one is
  // compromised the other remains safe — defense-in-depth.
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,

  // Secret key used to sign REFRESH tokens — a separate key ensures that
  // even a leaked access-token secret cannot forge refresh tokens.
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,

  // How long an access token is valid (e.g. "15m"). Short TTLs limit the
  // damage window if a token is stolen.
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',

  // How long a refresh token is valid (e.g. "7d"). Longer TTL provides
  // convenience — users don't have to re-login constantly.
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',

  // Salt rounds for password hashing from environment (.env)
  SALT_ROUNDS: process.env.SALT_ROUND || '12',
};

// Freeze the object so no part of the application can accidentally mutate
// configuration at runtime — a subtle but critical safety net.
Object.freeze(dotEnvConfig);
