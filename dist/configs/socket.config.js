"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketConfig = void 0;
const envConfig_1 = require("./envConfig");
const parseOrigins = (value) => {
    if (!value || value === '*') {
        return '*';
    }
    return value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
};
exports.socketConfig = {
    cors: {
        origin: parseOrigins(envConfig_1.dotEnvConfig.SOCKET_CORS_ORIGIN),
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 25000,
};
