// ──────────────────────────────────────────────────────────────────────────────
// FILE: database-source.ts
// PURPOSE: Creates and exports the TypeORM DataSource instance — the central
//          object that manages the database connection pool, entity metadata,
//          migrations, and query execution. Every repository in the app
//          derives its connection from this single DataSource.
//
// WHY A DEDICATED FILE? Separating the DataSource from the bootstrap logic
// lets us import it independently in CLI tools (migrations, seeders) without
// booting the entire Express server.
// ──────────────────────────────────────────────────────────────────────────────

// `reflect-metadata` must be imported BEFORE TypeORM because TypeORM uses
// the Reflect Metadata API (decorators) to read entity column definitions.
// Without this import, all `@Column()` decorators silently fail.
import 'reflect-metadata';

// `DataSource` is TypeORM's entry point — it replaces the older
// `createConnection()` API and supports connection pooling out of the box.
import { DataSource } from 'typeorm';

// Import the centralized env config so we read the DATABASE_URL from one
// place — no scattered `process.env` calls that could drift out of sync.
import { dotEnvConfig } from '../configs/envConfig';

// Import the User entity so TypeORM knows which tables to manage.
// Every new entity must be added to the `entities` array below.
import { User } from '../entities/user.entity';

// ─── DataSource Configuration ───────────────────────────────────────────────

const databaseUrl = dotEnvConfig.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// We export a singleton DataSource. TypeORM will reuse this instance
// throughout the application's lifetime, maintaining a connection pool.
export const AppDataSource = new DataSource({
  // `postgres` tells TypeORM to use the PostgreSQL driver (pg).
  type: 'postgres',

  // Pass the full connection URL — this is the simplest way to configure
  // host, port, user, password, and database in one string. Our Neon
  // PostgreSQL URL already contains SSL parameters.
  url: databaseUrl,

  // `synchronize: true` auto-creates/alters tables to match entity
  // definitions. This is ONLY safe in development — in production you
  // MUST use migrations to avoid accidental data loss.
  synchronize: dotEnvConfig.NODE_ENV !== 'production',

  // Enable query logging in development for debugging slow queries.
  // Disabled in production to avoid flooding logs with SQL.
  logging: dotEnvConfig.NODE_ENV !== 'production',

  // Register all entity classes here. TypeORM scans these to build
  // the database schema and create repositories.
  entities: [User],

  // SSL configuration required by Neon PostgreSQL (cloud-hosted).
  // `rejectUnauthorized: false` accepts Neon's self-signed cert —
  // necessary for pooler connections.
  ssl: {
    rejectUnauthorized: false,
  },
});
