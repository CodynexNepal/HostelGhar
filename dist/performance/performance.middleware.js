"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPerformanceMiddleware = void 0;
const compression_1 = require("./http/compression");
const registerPerformanceMiddleware = (app) => {
    // Brotli-first response compression (see http/compression.ts). The caller
    // (src/configs/app.ts) registers this AFTER helmet/CORS and BEFORE body
    // parsers, rate limiters and routes, so its res.write/res.end overrides wrap
    // every handler's response — JSON payloads go out ~15-25% smaller than gzip
    // would send them — without ever touching preflights or security headers.
    app.use(compression_1.compressionMiddleware);
};
exports.registerPerformanceMiddleware = registerPerformanceMiddleware;
