"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatError = void 0;
const formatError = (error) => ({
    error: error instanceof Error ? error.message : String(error),
});
exports.formatError = formatError;
