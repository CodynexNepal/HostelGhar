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

export const uploadOwnerImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
}).single('image');

export const normalizeOwnerFields = (
  req: Request,
  _res: unknown,
  next: (err?: unknown) => void,
): void => {
  if (req.body && typeof req.body === 'object') {
    const body = req.body as Record<string, unknown>;
    if (body.name === undefined && body.ownerName !== undefined) {
      body.name = body.ownerName;
    }
    delete body.ownerName;
    delete body.address;
  }
  next();
};

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

// ─── 5. Room Image Upload Middleware (Max 5MB, single `image` field) ───────
export const uploadRoomImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
}).single('image');

/**
 * Picks the uploaded room image file (`image` field) regardless of
 * single vs fields storage shape.
 */
export const pickRoomImageFile = (req: Request): Express.Multer.File | undefined => {
  const single = (req as Request & { file?: Express.Multer.File }).file;
  if (single) return single;
  const files = req.files as
    { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  if (!files) return undefined;
  if (Array.isArray(files)) return files[0];
  return files['image']?.[0];
};

// ─── 6. Resident CSV Import Upload (Max 5MB, accepts common field names) ─
// Some clients send the file as `file`, others as `csv`, `csvFile`, or similar.
// Keep the field names flexible so the request does not fail before validation.
const RESIDENT_CSV_FIELD_NAMES = ['file', 'csv', 'csvFile', 'residentCsv', 'importFile'];

export const pickResidentCsvFile = (req: Request): Express.Multer.File | undefined => {
  const single = (req as Request & { file?: Express.Multer.File }).file;
  if (single) return single;

  const files = req.files as
    { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  if (!files) return undefined;
  if (Array.isArray(files)) return files[0];

  for (const name of RESIDENT_CSV_FIELD_NAMES) {
    const match = files[name]?.[0];
    if (match) return match;
  }

  const firstFile = Object.values(files)[0]?.[0];
  return firstFile;
};

export const uploadResidentCsv = multer({
  storage: memoryStorage,
  fileFilter: (_req, file, callback) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv'];
    const nameOk = /\.csv$/i.test(file.originalname ?? '');
    if (allowed.includes(file.mimetype) || nameOk) {
      callback(null, true);
    } else {
      callback(
        createHttpError(
          STATUS_CODE.BAD_REQUEST,
          `Invalid file type: ${file.mimetype}. Only CSV files (.csv) are allowed.`,
        ) as unknown as null,
        false,
      );
    }
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).fields(RESIDENT_CSV_FIELD_NAMES.map((name) => ({ name, maxCount: 1 })));

// ─── 6. Hostel Payment QR Code Upload Middleware (Max 5MB) ───────────────────
const PAYMENT_QR_FIELD_NAMES = ['qrCode', 'image', 'file', 'qr'];

export const pickPaymentQrFile = (req: Request): Express.Multer.File | undefined => {
  const single = (req as Request & { file?: Express.Multer.File }).file;
  if (single) return single;

  const files = req.files as
    { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  if (!files) return undefined;
  if (Array.isArray(files)) return files[0];

  for (const name of PAYMENT_QR_FIELD_NAMES) {
    const match = files[name]?.[0];
    if (match) return match;
  }

  const firstFile = Object.values(files)[0]?.[0];
  return firstFile;
};

export const uploadPaymentQr = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).fields(PAYMENT_QR_FIELD_NAMES.map((name) => ({ name, maxCount: 1 })));

// ─── 6b. PLATFORM CHECKOUT QR Upload (Max 4MB) ───────────────────────────────
// The dashboard uploads the platform checkout QR under the `qrImage` field
// (multipart) or sends a JSON `qrImageUrl`. Accept the common fallbacks too.
const PLATFORM_QR_FIELD_NAMES = ['qrImage', 'qr', 'image', 'file', 'qrCode'];

export const pickPlatformQrFile = (req: Request): Express.Multer.File | undefined => {
  const single = (req as Request & { file?: Express.Multer.File }).file;
  if (single) return single;

  const files = req.files as
    { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  if (!files) return undefined;
  if (Array.isArray(files)) return files[0];

  for (const name of PLATFORM_QR_FIELD_NAMES) {
    const match = files[name]?.[0];
    if (match) return match;
  }

  const firstFile = Object.values(files)[0]?.[0];
  return firstFile;
};

export const uploadPlatformQr = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
}).fields(PLATFORM_QR_FIELD_NAMES.map((name) => ({ name, maxCount: 1 })));

// ─── 7. Resident Payment Proof Screenshot Upload (Max 4MB) ───────────────────
// The dashboard appends the SAME screenshot under two field names
// (`screenshot` AND `receipt`), so accept both plus generic fallbacks.
const PAYMENT_PROOF_FIELD_NAMES = ['screenshot', 'receipt', 'image', 'file'];

export const pickPaymentProofFile = (req: Request): Express.Multer.File | undefined => {
  const single = (req as Request & { file?: Express.Multer.File }).file;
  if (single) return single;

  const files = req.files as
    { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  if (!files) return undefined;
  if (Array.isArray(files)) return files[0];

  for (const name of PAYMENT_PROOF_FIELD_NAMES) {
    const match = files[name]?.[0];
    if (match) return match;
  }

  const firstFile = Object.values(files)[0]?.[0];
  return firstFile;
};

export const uploadPaymentProof = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  // 4MB matches the dashboard's own "under 4MB" client-side guard.
  limits: { fileSize: 4 * 1024 * 1024, files: PAYMENT_PROOF_FIELD_NAMES.length },
}).fields(PAYMENT_PROOF_FIELD_NAMES.map((name) => ({ name, maxCount: 1 })));

// ─── 9. Staff Photo Upload Middleware (Max 5MB, single `photo` field) ───────
export const uploadStaffPhoto = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit — matches "PNG, JPG or WEBP · up to 5 MB"
    files: 1,
  },
}).single('photo');

/**
 * Normalizes staff form field aliases BEFORE DTO validation runs.
 *
 * The dashboard staff form posts `name` (full name) and `salary` (monthly
 * salary), while the API DTO uses `fullName` / `monthlySalary`. Because
 * `validateDto` runs with `forbidNonWhitelisted: true`, unknown keys are
 * rejected outright — so rename them here instead of failing the request.
 * Also drops empty-string optional fields from multipart forms so `@IsOptional`
 * / `@ValidateIf` treat them as absent.
 */
export const normalizeStaffFields = (
  req: Request,
  _res: unknown,
  next: (err?: unknown) => void,
): void => {
  if (req.body && typeof req.body === 'object') {
    const body = req.body as Record<string, unknown>;
    const aliases: Array<[string, string]> = [
      ['name', 'fullName'],
      ['full_name', 'fullName'],
      ['salary', 'monthlySalary'],
      ['monthly_salary', 'monthlySalary'],
      ['phoneNumber', 'phone'],
      ['phone_number', 'phone'],
      ['emergency_contact', 'emergencyContact'],
    ];
    for (const [alias, canonical] of aliases) {
      if (body[canonical] === undefined && body[alias] !== undefined) {
        body[canonical] = body[alias];
      }
      delete body[alias];
    }
    for (const key of ['hostelId', 'fullName', 'email', 'monthlySalary', 'emergencyContact']) {
      if (body[key] === '') delete body[key];
    }
  }
  next();
};

/**
 * Normalizes invoice form field aliases BEFORE DTO validation runs.
 * Dashboard "Create invoice" forms post resident_name / due_date / total /
 * sendNow-style keys; the DTO uses residentName / dueDate / amount / sendMode.
 * Strict whitelist mode would 422 unknown keys, so rename them here.
 */
export const normalizeInvoiceFields = (
  req: Request,
  _res: unknown,
  next: (err?: unknown) => void,
): void => {
  if (req.body && typeof req.body === 'object') {
    const body = req.body as Record<string, unknown>;
    const pick = (...keys: string[]): unknown => {
      for (const key of keys) {
        const value = body[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return undefined;
    };
    const resident = pick('residentName', 'resident_name', 'resident', 'name', 'studentName');
    if (resident !== undefined) body.residentName = resident;
    const amount = pick('amount', 'total', 'totalPayable', 'total_payable', 'price');
    if (amount !== undefined) body.amount = amount;
    const due = pick('dueDate', 'due_date', 'due', 'deadline');
    if (due !== undefined) body.dueDate = due;
    const month = pick('billingMonth', 'billing_month', 'month', 'billingPeriod', 'billing_period');
    if (month !== undefined) body.billingMonth = month;
    const year = pick('billingYear', 'billing_year', 'year');
    if (year !== undefined) body.billingYear = year;
    const mode = pick('sendMode', 'send_mode', 'mode', 'action', 'status');
    if (mode !== undefined && body.sendMode === undefined && body.status === undefined) {
      body.sendMode = mode;
    }
    const sendNow = pick('sendNow', 'send_now', 'sendEmail', 'send_email', 'notify');
    if (sendNow !== undefined) body.sendNow = sendNow;
    for (const stale of [
      'resident_name',
      'resident',
      'name',
      'studentName',
      'total',
      'totalPayable',
      'total_payable',
      'price',
      'due_date',
      'due',
      'deadline',
      'billing_month',
      'month',
      'billingPeriod',
      'billing_period',
      'billing_year',
      'year',
      'send_mode',
      'mode',
      'action',
      'send_now',
      'sendEmail',
      'send_email',
      'notify',
    ]) {
      delete body[stale];
    }
    for (const key of ['hostelId', 'residentId', 'residentEmail', 'due_date']) {
      if (body[key] === '') delete body[key];
    }
  }
  next();
};

/**
 * Picks the uploaded staff photo file (`photo` field) regardless of
 * single vs fields storage shape.
 */
export const pickStaffPhotoFile = (req: Request): Express.Multer.File | undefined => {
  const single = (req as Request & { file?: Express.Multer.File }).file;
  if (single) return single;
  const files = req.files as
    { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  if (!files) return undefined;
  if (Array.isArray(files)) return files[0];
  return files['photo']?.[0];
};

// ─── 8. Subscription Payment Proof Screenshot Upload (Max 4MB) ───────────────
// The dashboard uploads the plan-upgrade payment screenshot under the `proof`
// field; other clients may use `screenshot` / `image` / `file` / `receipt`.
const SUBSCRIPTION_PROOF_FIELD_NAMES = ['proof', 'screenshot', 'receipt', 'image', 'file'];

export const pickSubscriptionProofFile = (req: Request): Express.Multer.File | undefined => {
  const single = (req as Request & { file?: Express.Multer.File }).file;
  if (single) return single;

  const files = req.files as
    { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  if (!files) return undefined;
  if (Array.isArray(files)) return files[0];

  for (const name of SUBSCRIPTION_PROOF_FIELD_NAMES) {
    const match = files[name]?.[0];
    if (match) return match;
  }

  const firstFile = Object.values(files)[0]?.[0];
  return firstFile;
};

export const uploadSubscriptionProof = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 4 * 1024 * 1024, files: SUBSCRIPTION_PROOF_FIELD_NAMES.length },
}).fields(SUBSCRIPTION_PROOF_FIELD_NAMES.map((name) => ({ name, maxCount: 1 })));
