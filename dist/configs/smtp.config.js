"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSmtpConfigured = exports.smtpConfig = void 0;
const envConfig_1 = require("./envConfig");
exports.smtpConfig = {
    host: envConfig_1.dotEnvConfig.SMTP_HOST,
    port: envConfig_1.dotEnvConfig.SMTP_PORT,
    secure: envConfig_1.dotEnvConfig.SMTP_SECURE,
    auth: envConfig_1.dotEnvConfig.SMTP_USER && envConfig_1.dotEnvConfig.SMTP_PASS
        ? {
            user: envConfig_1.dotEnvConfig.SMTP_USER,
            pass: envConfig_1.dotEnvConfig.SMTP_PASS,
        }
        : undefined,
    from: envConfig_1.dotEnvConfig.SMTP_FROM,
    enabled: Boolean(envConfig_1.dotEnvConfig.SMTP_HOST),
};
const assertSmtpConfigured = () => {
    if (!exports.smtpConfig.enabled || !exports.smtpConfig.auth) {
        throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS before sending email.');
    }
};
exports.assertSmtpConfigured = assertSmtpConfigured;
