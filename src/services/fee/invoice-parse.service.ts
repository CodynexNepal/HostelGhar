// ─────────────────────────────────────────────────────────────
// FILE: invoice-parse.service.ts
// PURPOSE: Pure parsing helpers for manual invoice creation (Draft vs Send-now).
// ─────────────────────────────────────────────────────────────

import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CreateInvoiceDto } from '../../dto/fee/create-invoice.dto';
import { FeeStatus } from '../../enum/fee.enum';
import { createHttpError } from '../../utils/createHttpError';

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

export const parseInvoiceBillingPeriod = (
  billingMonth: number | string,
  billingYear?: number | string,
): { month: number; year: number } => {
  const now = new Date();
  const yearNum = Number(billingYear);
  const fallbackYear =
    Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100 ? yearNum : now.getFullYear();

  if (typeof billingMonth === 'number' || /^\d+$/.test(String(billingMonth).trim())) {
    const month = Number(billingMonth);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw createHttpError(
        STATUS_CODE.BAD_REQUEST,
        'billingMonth must be 1-12 or like "2026-09" / "September 2026"',
      );
    }
    return { month, year: fallbackYear };
  }

  const raw = String(billingMonth).trim();
  let match = raw.match(/^(\d{4})[-/](\d{1,2})$/);
  if (match && match[1] && match[2]) {
    const month = Number(match[2]);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'billingMonth must be 1-12');
    }
    return { month, year: Number(match[1]) };
  }
  match = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (match && match[1] && match[2]) {
    const month = Number(match[1]);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'billingMonth must be 1-12');
    }
    return { month, year: Number(match[2]) };
  }
  match = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (match && match[1] && match[2]) {
    const month = MONTH_NAMES[match[1].toLowerCase() as keyof typeof MONTH_NAMES];
    if (!month) throw createHttpError(STATUS_CODE.BAD_REQUEST, `Unknown month name: ${match[1]}`);
    return { month, year: Number(match[2]) };
  }
  match = raw.match(/^(\d{4})\s+([A-Za-z]+)$/);
  if (match && match[1] && match[2]) {
    const month = MONTH_NAMES[match[2].toLowerCase() as keyof typeof MONTH_NAMES];
    if (!month) throw createHttpError(STATUS_CODE.BAD_REQUEST, `Unknown month name: ${match[2]}`);
    return { month, year: Number(match[1]) };
  }
  const monthOnly = MONTH_NAMES[raw.toLowerCase()];
  if (monthOnly) return { month: monthOnly, year: fallbackYear };
  throw createHttpError(
    STATUS_CODE.BAD_REQUEST,
    'billingMonth must be 1-12 or like "2026-09", "09/2026" or "September 2026"',
  );
};

export const parseInvoiceDueDate = (dueDate: string): string => {
  const raw = String(dueDate ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime()))
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'dueDate is not a real calendar date');
    return raw;
  }
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match && match[1] && match[2] && match[3]) {
    const iso = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime()))
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'dueDate is not a real calendar date');
    return iso;
  }
  throw createHttpError(STATUS_CODE.BAD_REQUEST, 'dueDate must be YYYY-MM-DD or mm/dd/yyyy');
};

export const resolveInvoiceSendMode = (dto: CreateInvoiceDto): 'DRAFT' | 'SEND_NOW' => {
  const truthy = (value: unknown): boolean =>
    value === true ||
    value === 1 ||
    String(value ?? '')
      .trim()
      .toLowerCase() === 'true';
  const raw = [dto.sendMode, dto.status, dto.paymentStatus, dto.payment_status]
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) =>
      String(value)
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_'),
    );
  if (truthy(dto.sendNow)) return 'SEND_NOW';
  for (const value of raw) {
    if (
      [
        'SEND_NOW',
        'SENDNOW',
        'SEND',
        'SENT',
        'FINAL',
        'ISSUE',
        'ISSUED',
        'PAID',
        'PENDING',
        'OVERDUE',
        'PARTIALLY_PAID',
      ].includes(value)
    )
      return 'SEND_NOW';
    if (['DRAFT', 'PREVIEW', 'SAVE'].includes(value)) return 'DRAFT';
  }
  if (dto.feeStatus && dto.feeStatus !== FeeStatus.PENDING) return 'SEND_NOW';
  return 'DRAFT';
};
