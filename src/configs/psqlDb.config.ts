// ──────────────────────────────────────────────────────────────────────────────
// FILE: psqlDb.config.ts
// PURPOSE: Production-grade PostgreSQL & TypeORM configuration providing
//          connection pooling options, SSL configuration, migration paths,
//          and dynamic entity registration.
// ──────────────────────────────────────────────────────────────────────────────

import { DataSourceOptions } from 'typeorm';
import { dotEnvConfig } from './envConfig';

const isProduction = dotEnvConfig.NODE_ENV === 'production';

// Ensure DATABASE_URL is present
const databaseUrl = dotEnvConfig.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required in configuration.');
}

/**
 * Production-ready PostgreSQL TypeORM configuration options.
 */
export const psqlDbConfig: DataSourceOptions = {
  type: 'postgres',
  url: databaseUrl,

  // ─── Schema Synchronization & Logging ───────────────────────────────────────
  // CRITICAL: NEVER set synchronize to true in production as it can drop/alter tables!
  synchronize: !isProduction,
  logging: !isProduction ? ['query', 'error', 'warn', 'schema'] : ['error', 'warn'],

  // ─── Entities, Migrations & Subscribers ────────────────────────────────────
  // Supports both direct entity imports and glob patterns for dynamic loading
  entities: [isProduction ? 'dist/entities/**/*.entity.js' : 'src/entities/**/*.entity.ts'],
  migrations: [
    isProduction ? 'dist/database/migrations/**/*.js' : 'src/database/migrations/**/*.ts',
  ],
  subscribers: [isProduction ? 'dist/subscribers/**/*.js' : 'src/subscribers/**/*.ts'],

  // Run pending migrations automatically upon connection initialization in production
  migrationsRun: isProduction,
  migrationsTableName: 'typeorm_migrations',

  // ─── Connection Pooling Configuration (pg driver options) ─────────────────
  extra: {
    // Maximum number of connections in the pool
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    // Minimum number of idle connections to maintain in pool
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    // Milliseconds a client must wait before connection allocation times out
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
    // Milliseconds a client can remain idle before being closed
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    // KeepAlive configuration to prevent idle connection termination by cloud firewalls
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Enable SSL only for remote/cloud databases. Local Docker Postgres should remain plain TCP.
    ssl:
      !databaseUrl.includes('127.0.0.1') &&
      !databaseUrl.includes('localhost') &&
      (isProduction || databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech'))
        ? {
            rejectUnauthorized: false,
          }
        : false,
  },

  // ─── Cache Configuration (Optional TypeORM query result cache) ─────────────
  cache: true,
};

export default psqlDbConfig;
