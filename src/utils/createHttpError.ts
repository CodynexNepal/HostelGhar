// ──────────────────────────────────────────────────────────────────────────────
// FILE: createHttpError.ts
// PURPOSE: Lightweight HTTP error factory supporting flexible argument order.
// ──────────────────────────────────────────────────────────────────────────────

export type HttpError = Error & { statusCode: number };

export function createHttpError(statusCode: number, message: string): HttpError;
export function createHttpError(message: string, statusCode: number): HttpError;
export function createHttpError(arg1: number | string, arg2: number | string): HttpError {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (typeof arg1 === 'number') {
    statusCode = arg1;
    message = String(arg2);
  } else {
    message = String(arg1);
    statusCode = typeof arg2 === 'number' ? arg2 : 500;
  }

  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}
