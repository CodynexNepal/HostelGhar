import { describe, expect, it, vi } from 'vitest';
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

  it('falls back gracefully to direct background execution when BullMQ/Redis throws ECONNREFUSED', async () => {
    const { ResidentImportService } =
      await import('../../src/services/resident/resident-import.service');
    const { residentImportQueue } = await import('../../src/queue/queue.factory');
    const { ResidentImportWorker } = await import('../../src/workers/resident-import.worker');

    const mockImportRepo = {
      create: (data: any) => ({ id: 'import-123', ...data }),
      save: async (data: any) => data,
      countActiveToday: async () => 0,
      findByIdempotency: async () => null,
    };
    const mockOwnerRepo = {
      findHostelByIdAndOwner: async () => ({ id: 'hostel-1', name: 'Test Hostel' }),
    };

    const service = new ResidentImportService(mockImportRepo as any, mockOwnerRepo as any);

    // Mock BullMQ queue failure (e.g. ECONNREFUSED)
    const queueSpy = vi
      .spyOn(residentImportQueue, 'add')
      .mockRejectedValue(new Error('connect ECONNREFUSED 44.201.93.64:12861'));

    const directWorkerSpy = vi
      .spyOn(ResidentImportWorker, 'executeImport')
      .mockResolvedValue({ id: 'import-123', success: 1, failed: 0 } as any);

    const validCsv = 'name,email,phone,room,bed,rent\nRam,ram@test.com,9841000000,101,B1,10000';
    const result = await service.enqueueImport({
      hostelId: 'hostel-1',
      ownerId: 'owner-1',
      role: 'owner',
      fileName: 'test.csv',
      fileBuffer: Buffer.from(validCsv),
    });

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data?.import.status).toBe('QUEUED');
    expect(queueSpy).toHaveBeenCalledWith(
      'RESIDENT_CSV_IMPORT',
      expect.anything(),
      expect.anything(),
    );

    // Allow setImmediate loop to execute
    await new Promise((resolve) => setImmediate(resolve));
    expect(directWorkerSpy).toHaveBeenCalledTimes(1);
  });
});
