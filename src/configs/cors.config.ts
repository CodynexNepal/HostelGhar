import { CorsOptions } from 'cors';
import { dotEnvConfig } from './envConfig';

const parseOrigins = (value: string): string[] | boolean => {
  if (!value || value === '*') {
    return true;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const corsConfig: CorsOptions = {
  origin: parseOrigins(dotEnvConfig.CORS_ORIGIN),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
};
