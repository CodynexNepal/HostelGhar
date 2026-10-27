"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: createHttpError.ts
// PURPOSE: Lightweight HTTP error factory supporting flexible argument order.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpError = createHttpError;
function createHttpError(arg1, arg2) {
    let statusCode = 500;
    let message = 'Internal Server Error';
    if (typeof arg1 === 'number') {
        statusCode = arg1;
        message = String(arg2);
    }
    else {
        message = String(arg1);
        statusCode = typeof arg2 === 'number' ? arg2 : 500;
    }
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
