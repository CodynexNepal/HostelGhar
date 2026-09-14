// ──────────────────────────────────────────────────────────────────────────────
// FILE: cloudinary.config.ts
// PURPOSE: Centralized Cloudinary SDK configuration with credentials validation.
// ──────────────────────────────────────────────────────────────────────────────

import { v2 as cloudinary } from 'cloudinary';
import { dotEnvConfig } from './envConfig';

// Initialize Cloudinary instance with credentials from environment
cloudinary.config({
  cloud_name: dotEnvConfig.CLOUDINARY_CLOUD_NAME,
  api_key: dotEnvConfig.CLOUDINARY_API_KEY,
  api_secret: dotEnvConfig.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };
