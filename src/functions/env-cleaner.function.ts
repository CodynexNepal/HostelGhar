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
  CORS_ORIGIN: string;
  SOCKET_CORS_ORIGIN: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
  RECAPTCHA_SECRET_KEY: string;
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
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const nodeEnv = (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';
  const defaultDatabaseUrl =
    nodeEnv === 'production'
      ? undefined
      : 'postgresql://hostelghar:hostelghar_dev_pass@127.0.0.1:5432/hostelghar_dev';
  const defaultRedisUrl = nodeEnv === 'production' ? undefined : 'redis://127.0.0.1:6379';

  const config: CleanEnvConfig = {
    PORT: Number.isNaN(port) ? 3000 : port,
    NODE_ENV: nodeEnv,
    DATABASE_URL: getRequiredEnv('DATABASE_URL', process.env.DATABASE_URL || defaultDatabaseUrl),
    REDIS_URL: getRequiredEnv('REDIS_URL', process.env.REDIS_URL || defaultRedisUrl)
      .replace(/^REDIS_URL=/, '')
      .replace(/^"|"$/g, '')
      .trim(),
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
    ACCESS_TOKEN_SECRET: getRequiredEnv('ACCESS_TOKEN_SECRET'),
    REFRESH_TOKEN_SECRET: getRequiredEnv('REFRESH_TOKEN_SECRET'),
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    SALT_ROUNDS: Number.isNaN(saltRounds) ? 10 : saltRounds,
    CORS_ORIGIN:
      process.env.CORS_ORIGIN ||
      process.env.FRONTEND_ORIGIN ||
      process.env.FRONTEND_URL ||
      (nodeEnv === 'production' ? '' : '*'),
    SOCKET_CORS_ORIGIN:
      process.env.SOCKET_CORS_ORIGIN ||
      process.env.CORS_ORIGIN ||
      process.env.FRONTEND_ORIGIN ||
      process.env.FRONTEND_URL ||
      '*',
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: Number.isNaN(smtpPort) ? 587 : smtpPort,
    SMTP_SECURE: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM:
      process.env.SMTP_FROM ||
      `HostelGhar <${process.env.SMTP_USER || 'no-reply@hostelghar.local'}>`,
    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY || '',
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
    CORS_ORIGIN: config.CORS_ORIGIN,
    SOCKET_CORS_ORIGIN: config.SOCKET_CORS_ORIGIN,
    SMTP_HOST: config.SMTP_HOST ? '[CONFIGURED]' : '[NOT_SET]',
    SMTP_PORT: config.SMTP_PORT,
    SMTP_SECURE: String(config.SMTP_SECURE),
    SMTP_USER: maskString(config.SMTP_USER),
    SMTP_PASS: '[REDACTED_SECRET]',
    SMTP_FROM: config.SMTP_FROM,
    RECAPTCHA_SECRET_KEY: config.RECAPTCHA_SECRET_KEY ? '[CONFIGURED]' : '[NOT_SET]',
  };
}
