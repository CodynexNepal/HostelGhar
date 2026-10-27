"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databasePoolConfig = void 0;
exports.databasePoolConfig = Object.freeze({
    max: Number(process.env.DB_POOL_MAX || 20),
    min: Number(process.env.DB_POOL_MIN || 2),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT || 5000),
});
