"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slowQueryThresholdMs = void 0;
exports.slowQueryThresholdMs = Number(process.env.DB_SLOW_QUERY_MS || 500);
