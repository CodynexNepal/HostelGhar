// ──────────────────────────────────────────────────────────────────────────────
// FILE: env-cleaner.function.ts
// PURPOSE: Validates, cleans, and sanitizes environment variables at boot time.
//          - Ensures required values are present (fails fast if missing).
//          - Parses and assigns strongly typed values with strict defaults.
//          - Masks/redacts sensitive values (passwords, JWT secrets, salt rounds)
//            to prevent accidental exposure in logs, monitoring, or error reports.
// ──────────────────────────────────────────────────────────────────────────────

export interface CleanEnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  DATABASE_URL: string;
  REDIS_URL: string;
  USE_DIRECT_SMTP: boolean;
  ENABLE_REDIS: boolean;
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
 * Sanitizes and validates JWT token expiration strings (e.g. "15m", "7d", "3600").
 * Strips accidental surrounding quotes and whitespace, and validates the format
 * to prevent jsonwebtoken sign runtime errors.
 */
export function cleanTokenExpiry(val?: string, fallback: string = '15m'): string {
  if (!val || typeof val !== 'string') return fallback;
  const cleaned = val.replace(/^["']|["']$/g, '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'undefined' || cleaned.toLowerCase() === 'null') {
    return fallback;
  }
  const isNumeric = /^\d+$/.test(cleaned);
  const isTimespan =
    /^(\d+)\s*(s|m|h|d|w|y|sec|secs|second|seconds|min|mins|minute|minutes|hr|hrs|hour|hours|day|days)$/i.test(
      cleaned,
    );
  if (isNumeric || isTimespan) {
    return cleaned;
  }
  return fallback;
}

/**
 * Cleans, sanitizes, and returns the strongly typed configuration object.
 */
export function cleanEnvConfig(): CleanEnvConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const saltRounds = parseInt(process.env.SALT_ROUND || process.env.SALT_ROUNDS || '10', 10);
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const nodeEnv = (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';

  // In production (cPanel shared hosting without Redis/workers), default to Direct SMTP (Nodemailer)
  // unless Redis is explicitly enabled via ENABLE_REDIS=true.
  const isProd = nodeEnv === 'production';
  const useDirectSmtp =
    process.env.USE_DIRECT_SMTP === 'true' ||
    process.env.ENABLE_REDIS === 'false' ||
    (isProd && process.env.ENABLE_REDIS !== 'true');

  const enableRedis =
    !useDirectSmtp &&
    (isProd ? process.env.ENABLE_REDIS === 'true' : process.env.ENABLE_REDIS !== 'false');

  const defaultDatabaseUrl =
    nodeEnv === 'production'
      ? undefined
      : 'postgresql://hostelghar:hostelghar_dev_pass@127.0.0.1:5432/hostelghar_dev';

  const defaultRedisUrl = 'redis://127.0.0.1:6379';

  const defaultAccessSecret =
    nodeEnv === 'production'
      ? undefined
      : 'dev-or-test-access-token-secret-must-be-at-least-32-chars-long';

  const defaultRefreshSecret =
    nodeEnv === 'production'
      ? undefined
      : 'dev-or-test-refresh-token-secret-must-be-at-least-32-chars-long';

  const rawRedisUrl = (process.env.REDIS_URL || defaultRedisUrl)
    .replace(/^REDIS_URL=/, '')
    .replace(/^"|"$/g, '')
    .trim();

  const config: CleanEnvConfig = {
    PORT: Number.isNaN(port) ? 3000 : port,
    NODE_ENV: nodeEnv,
    DATABASE_URL: getRequiredEnv('DATABASE_URL', process.env.DATABASE_URL || defaultDatabaseUrl),
    REDIS_URL: rawRedisUrl || defaultRedisUrl,
    USE_DIRECT_SMTP: useDirectSmtp,
    ENABLE_REDIS: enableRedis,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
    ACCESS_TOKEN_SECRET: getRequiredEnv(
      'ACCESS_TOKEN_SECRET',
      process.env.ACCESS_TOKEN_SECRET || defaultAccessSecret,
    ),
    REFRESH_TOKEN_SECRET: getRequiredEnv(
      'REFRESH_TOKEN_SECRET',
      process.env.REFRESH_TOKEN_SECRET || defaultRefreshSecret,
    ),
    ACCESS_TOKEN_EXPIRY: cleanTokenExpiry(process.env.ACCESS_TOKEN_EXPIRY, '15m'),
    REFRESH_TOKEN_EXPIRY: cleanTokenExpiry(process.env.REFRESH_TOKEN_EXPIRY, '7d'),
    SALT_ROUNDS: Number.isNaN(saltRounds) ? 10 : saltRounds,
    CORS_ORIGIN:
      process.env.CORS_ORIGIN ||
      process.env.FRONTEND_ORIGIN ||
      process.env.FRONTEND_URL ||
      'https://dashboard.hostelghar.com',
    SOCKET_CORS_ORIGIN:
      process.env.SOCKET_CORS_ORIGIN ||
      process.env.CORS_ORIGIN ||
      process.env.FRONTEND_ORIGIN ||
      process.env.FRONTEND_URL ||
      '*',
    SMTP_HOST: process.env.SMTP_HOST || (nodeEnv === 'test' ? 'mail.hostelghar.test' : ''),
    SMTP_PORT: Number.isNaN(smtpPort) ? 587 : smtpPort,
    SMTP_SECURE: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
    SMTP_USER: process.env.SMTP_USER || (nodeEnv === 'test' ? 'notifications@hostelghar.test' : ''),
    SMTP_PASS: process.env.SMTP_PASS || (nodeEnv === 'test' ? 'test-smtp-password' : ''),
    SMTP_FROM:
      process.env.SMTP_FROM ||
      `HostelGhar <${process.env.SMTP_USER || (nodeEnv === 'test' ? 'notifications@hostelghar.test' : 'info@hostelghar.com')}>`,
    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY || '',
  };

  return Object.freeze(config);
}

/**
 * Returns a masked/redacted version of the config object safe for logging or debugging.
 * Hides passwords, hashes, keys, salt rounds, and token secrets.
 */
export function getSanitizedEnvSummary(
  config: CleanEnvConfig,
): Record<string, string | number | boolean> {
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
    USE_DIRECT_SMTP: config.USE_DIRECT_SMTP,
    ENABLE_REDIS: config.ENABLE_REDIS,
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
    SMTP_HOST: config.SMTP_HOST || '[NOT_SET]',
    SMTP_PORT: config.SMTP_PORT,
    SMTP_SECURE: config.SMTP_SECURE,
    SMTP_USER: config.SMTP_USER ? maskString(config.SMTP_USER) : '[NOT_SET]',
    SMTP_PASS: '[REDACTED_SECRET]',
    SMTP_FROM: config.SMTP_FROM,
    RECAPTCHA_SECRET_KEY: config.RECAPTCHA_SECRET_KEY ? '[CONFIGURED]' : '[NOT_SET]',
  };
}
