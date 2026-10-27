"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: cloudinary.config.ts
// PURPOSE: Centralized Cloudinary SDK configuration with credentials validation.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = void 0;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
const envConfig_1 = require("./envConfig");
// Initialize Cloudinary instance with credentials from environment
cloudinary_1.v2.config({
    cloud_name: envConfig_1.dotEnvConfig.CLOUDINARY_CLOUD_NAME,
    api_key: envConfig_1.dotEnvConfig.CLOUDINARY_API_KEY,
    api_secret: envConfig_1.dotEnvConfig.CLOUDINARY_API_SECRET,
    secure: true,
});
