// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident-import.util.ts
// PURPOSE: Production CSV parsing + per-row validation for the Import Residents
//          background flow. Columns: name,email,phone,room,bed,rent.
//          Pure functions (no DB) so they are unit-testable.
// ──────────────────────────────────────────────────────────────────────────────

export interface ResidentImportCsvRow {
  line: number;
  name: string;
  email: string;
  phone: string;
  room: string;
  bed: string;
  rent: number | null;
  raw: Record<string, string>;
}

export interface ResidentImportCsvFailure {
  row: number;
  email?: string | undefined;
  message: string;
}

export interface ParsedResidentImportCsv {
  rows: ResidentImportCsvRow[];
  failures: ResidentImportCsvFailure[];
  totalRows: number;
}

export const RESIDENT_IMPORT_COLUMNS = ['name', 'email', 'phone', 'room', 'bed', 'rent'] as const;

export const RESIDENT_IMPORT_TEMPLATE_HEADER = 'name,email,phone,room,bed,rent';

export const RESIDENT_IMPORT_TEMPLATE_SAMPLE = [
  'Ram Sharma,ram.sharma@example.com,9841000001,101,B1,11000',
  'Sita Thapa,sita.thapa@example.com,9841000002,101,B2,11000',
  'Hari Bahadur,hari.bahadur@example.com,9841000003,102,B1,12000',
].join('\n');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d][\d\s\-()]{5,19}$/;

/**
 * Minimal RFC-4180 compatible CSV line splitter (handles quoted commas
 * and escaped double quotes) without adding a new dependency.
 */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i] as string;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeHeader(value: string): string {
  const lowered = value.trim().toLowerCase();
  if (['room_number', 'roomnumber', 'room no', 'roomno'].includes(lowered)) return 'room';
  if (['bed_number', 'bednumber', 'bed no', 'bedno'].includes(lowered)) return 'bed';
  if (['monthly_rent', 'monthlyrent', 'rent_rs', 'price'].includes(lowered)) return 'rent';
  return lowered;
}

export function buildResidentImportTemplate(): string {
  return `${RESIDENT_IMPORT_TEMPLATE_HEADER}\n${RESIDENT_IMPORT_TEMPLATE_SAMPLE}\n`;
}

export function parseResidentImportCsv(buffer: Buffer | string): ParsedResidentImportCsv {
  const text = (typeof buffer === 'string' ? buffer : buffer.toString('utf8')).replace(
    /^\uFEFF/,
    '',
  );
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [], failures: [{ row: 0, message: 'CSV file is empty' }], totalRows: 0 };
  }

  const headerCells = splitCsvLine(lines[0] as string).map(normalizeHeader);
  const missing = RESIDENT_IMPORT_COLUMNS.filter((col) => !headerCells.includes(col));
  if (missing.length > 0) {
    return {
      rows: [],
      failures: [
        {
          row: 1,
          message: `Missing required column(s): ${missing.join(', ')}. Expected: ${RESIDENT_IMPORT_TEMPLATE_HEADER}`,
        },
      ],
      totalRows: 0,
    };
  }

  const indexOf = (name: string): number => headerCells.indexOf(name);
  const rows: ResidentImportCsvRow[] = [];
  const failures: ResidentImportCsvFailure[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const cells = splitCsvLine(lines[i] as string);
    const get = (name: string): string => {
      const idx = indexOf(name);
      return idx >= 0 && idx < cells.length ? ((cells[idx] as string) ?? '').trim() : '';
    };
    const raw: Record<string, string> = {
      name: get('name'),
      email: get('email'),
      phone: get('phone'),
      room: get('room'),
      bed: get('bed'),
      rent: get('rent'),
    };

    const fail = (message: string): void => {
      failures.push({
        row: lineNumber,
        email: raw.email ? raw.email.toLowerCase() : undefined,
        message,
      });
    };

    if (!raw.name) {
      fail('name is required');
      continue;
    }
    if (!raw.email || !EMAIL_PATTERN.test(raw.email)) {
      fail(`invalid email "${raw.email || ''}"`);
      continue;
    }
    const emailKey = raw.email.toLowerCase();
    if (seenEmails.has(emailKey)) {
      fail(`duplicate email "${raw.email}" inside this CSV`);
      continue;
    }
    seenEmails.add(emailKey);
    if (!raw.phone || !PHONE_PATTERN.test(raw.phone)) {
      fail(`invalid phone "${raw.phone || ''}"`);
      continue;
    }
    if (!raw.room) {
      fail('room is required (must match an existing room number)');
      continue;
    }
    if (!raw.bed) {
      fail('bed is required (e.g. B1)');
      continue;
    }

    let rent: number | null = null;
    if (raw.rent) {
      const parsed = Number(raw.rent.replace(/[,Rs.\s]/gi, ''));
      if (!Number.isFinite(parsed) || parsed < 0) {
        fail(`invalid rent "${raw.rent}"`);
        continue;
      }
      rent = parsed;
    }

    rows.push({
      line: lineNumber,
      name: raw.name,
      email: raw.email.toLowerCase(),
      phone: raw.phone,
      room: raw.room,
      bed: raw.bed,
      rent,
      raw,
    });
  }

  return { rows, failures, totalRows: rows.length + failures.length };
}
