// ──────────────────────────────────────────────────────────────────────────────
// FILE: env-cleaner.function.ts
// PURPOSE: Validates, cleans, and sanitizes environment variables at boot time.
//          - Ensures required .env values are present (fails fast if missing).
//          - Parses and assigns strongly typed values with strict defaults.
//          - Masks/redacts sensitive values (passwords, JWT secrets, salt rounds)
//            to prevent accidental exposure in logs, monitoring, or error reports.
// ──────────────────────────────────────────────────────────────────────────────

export interface CleanEnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  DATABASE_URL: string;
  REDIS_URL: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  ACCESS_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_EXPIRY: string;
  SALT_ROUNDS: number;
}

/**
 * Validates that an environment variable exists, otherwise throws an error.
 */
function getRequiredEnv(key: string, customValue?: string): string {
  const value = customValue !== undefined ? customValue : process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`[Config Error] Missing required environment variable: ${key}`);
  }
  return value.trim();
}

/**
 * Cleans, sanitizes, and returns the strongly typed configuration object.
 */
export function cleanEnvConfig(): CleanEnvConfig {
  // Validate and parse required values
  const port = parseInt(process.env.PORT || '3000', 10);
  const saltRounds = parseInt(process.env.SALT_ROUND || process.env.SALT_ROUNDS || '10', 10);

  const config: CleanEnvConfig = {
    PORT: Number.isNaN(port) ? 3000 : port,
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    DATABASE_URL: getRequiredEnv('DATABASE_URL'),
    REDIS_URL:
      process.env.REDIS_URL?.replace(/^REDIS_URL=/, '')
        .replace(/^"|"$/g, '')
        .trim() || '',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
    ACCESS_TOKEN_SECRET: getRequiredEnv('ACCESS_TOKEN_SECRET'),
    REFRESH_TOKEN_SECRET: getRequiredEnv('REFRESH_TOKEN_SECRET'),
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    SALT_ROUNDS: Number.isNaN(saltRounds) ? 10 : saltRounds,
  };

  return Object.freeze(config);
}

/**
 * Returns a masked/redacted version of the config object safe for logging or debugging.
 * Hides passwords, hashes, keys, salt rounds, and token secrets.
 */
export function getSanitizedEnvSummary(config: CleanEnvConfig): Record<string, string | number> {
  const maskString = (val?: string) => {
    if (!val) return '[NOT_SET]';
    if (val.length <= 8) return '********';
    return `${val.substring(0, 4)}...${val.substring(val.length - 4)}`;
  };

  return {
    PORT: config.PORT,
    NODE_ENV: config.NODE_ENV,
    DATABASE_URL: maskString(config.DATABASE_URL),
    REDIS_URL: maskString(config.REDIS_URL),
    CLOUDINARY_CLOUD_NAME: config.CLOUDINARY_CLOUD_NAME ? '[CONFIGURED]' : '[NOT_SET]',
    CLOUDINARY_API_KEY: maskString(config.CLOUDINARY_API_KEY),
    CLOUDINARY_API_SECRET: '[REDACTED_SECRET]',
    ACCESS_TOKEN_SECRET: '[REDACTED_SECRET]',
    REFRESH_TOKEN_SECRET: '[REDACTED_SECRET]',
    ACCESS_TOKEN_EXPIRY: config.ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY: config.REFRESH_TOKEN_EXPIRY,
    SALT_ROUNDS: '[REDACTED_NUMBER]',
  };
}
