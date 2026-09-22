import { describe, expect, it } from 'vitest';
import {
  buildResidentImportTemplate,
  parseResidentImportCsv,
  splitCsvLine,
} from '../../src/utils/resident-import.util';
import { pickResidentCsvFile } from '../../src/middleware/upload.middleware';

describe('resident CSV import parser', () => {
  it('parses the documented columns and validates every row', () => {
    const csv = [
      'name,email,phone,room,bed,rent',
      'Ram Sharma,ram@example.com,9841000001,101,B1,11000',
      'Bad Row,not-an-email,123,102,,abc',
      'Ram Clone,RAM@example.com,9841000002,102,B1,11000',
    ].join('\n');
    const parsed = parseResidentImportCsv(csv);
    expect(parsed.totalRows).toBe(3);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.email).toBe('ram@example.com');
    expect(parsed.failures).toHaveLength(2);
  });

  it('rejects files with missing columns', () => {
    const parsed = parseResidentImportCsv('name,email\nA,a@b.com');
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.failures[0]?.message).toContain('Missing required column');
  });

  it('handles quoted commas and builds a downloadable template', () => {
    expect(splitCsvLine('"Doe, John",a@b.com,123,101,B1,100')).toHaveLength(6);
    const tpl = buildResidentImportTemplate();
    expect(tpl).toContain('name,email,phone,room,bed,rent');
  });

  it('picks a CSV upload from common multipart field names', () => {
    const file = {
      fieldname: 'csv',
      originalname: 'residents.csv',
      buffer: Buffer.from('name,email\nA,a@b.com'),
      mimetype: 'text/csv',
    } as Express.Multer.File;

    const req = {
      files: {
        csv: [file],
      },
    } as any;

    expect(pickResidentCsvFile(req)).toBe(file);
  });
});
