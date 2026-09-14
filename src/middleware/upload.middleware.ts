// ──────────────────────────────────────────────────────────────────────────────
// FILE: upload.middleware.ts
// PURPOSE: Production Multer upload middleware with strict MIME-type guards,
//          file size limits, and memory storage buffer handling.
// ──────────────────────────────────────────────────────────────────────────────

import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { STATUS_CODE } from '../constant/statusCode.interface';
import { createHttpError } from '../utils/createHttpError';

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

// File filter validation function
const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      createHttpError(
        STATUS_CODE.BAD_REQUEST,
        `Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP, AVIF.`,
      ) as unknown as null,
      false,
    );
  }
};

// Base memory storage instance (stores files in memory as Buffer for Cloudinary streaming)
const memoryStorage = multer.memoryStorage();

// ─── 1. Hostel Logo Upload Middleware (Max 3MB) ─────────────────────────────
// Accepts the file under EITHER `logo` or `image` field names — different
// admin forms/clients use different names. `.fields()` always populates
// `req.files` (never `req.file`), so controllers read from there.
export const uploadHostelLogo = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB limit
    files: 2, // two accepted field names (`logo` | `image`); service uses the first found
  },
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

/**
 * Picks the uploaded hostel logo file regardless of which accepted field
 * name (`logo` | `image`) the client used.
 */
export const pickHostelLogoFile = (req: Request): Express.Multer.File | undefined => {
  const files = req.files as
    { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  if (!files) return (req as Request & { file?: Express.Multer.File }).file;
  if (Array.isArray(files)) return files[0];
  return files['logo']?.[0] ?? files['image']?.[0];
};

/**
 * Removes stray TEXT parts that share a name with a file field (`logo`,
 * `image`) from `req.body` before DTO validation runs.
 *
 * Why: some clients append BOTH `form.append('logo', file)` AND a text part
 * `form.append('logo', file.name)`. Multer consumes only the file part into
 * `req.files`; the text part lands in `req.body.logo` as a string. That string
 * must never reach class-validator — `logo` is a FILE (buffer → Cloudinary),
 * not a `string` body field — otherwise `forbidNonWhitelisted` rejects with
 * "property logo should not exist" or `@IsString/@MaxLength` fails on garbage.
 * Real file uploads are untouched in `req.files` / `pickHostelLogoFile`.
 */
export const stripFileFields =
  (...fieldNames: string[]) =>
  (req: Request, _res: unknown, next: (err?: unknown) => void): void => {
    for (const name of fieldNames) {
      if (req.body && typeof req.body === 'object' && name in req.body) {
        delete (req.body as Record<string, unknown>)[name];
      }
    }
    next();
  };

// ─── 2. Student / Resident Photo Upload Middleware (Max 5MB) ────────────────
export const uploadStudentPhoto = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
}).single('photo');

// ─── 3. Student / Resident Document Upload Middleware (Max 10MB) ────────────
export const uploadStudentDocument = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
}).single('document');

// ─── 4. Resident Combined Media Upload (Photo + Document) ───────────────────
export const uploadResidentMedia = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
}).fields([
  { name: 'photo', maxCount: 1 },
  { name: 'document', maxCount: 1 },
]);
