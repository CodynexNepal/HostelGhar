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

// Import the centralized PostgreSQL database configuration
import { psqlDbConfig } from '../configs/psqlDb.config';

// We export a singleton DataSource configured with production pooling and migrations.
export const AppDataSource = new DataSource(psqlDbConfig);
