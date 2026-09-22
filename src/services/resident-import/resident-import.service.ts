// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident-import.service.ts
// PURPOSE: Orchestrates background CSV resident imports.
// ──────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { residentImportQueue } from '../../queue/queue.factory';
import { JobType } from '../../constant/queue.constants';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { IROLES } from '../../enum/roles.enum';
import { ResidentImport, ResidentImportStatus } from '../../entities/import/resident-import.entity';
import { ResidentImportRepository } from '../../repository/import/resident-import.repository';
import { OwnerRepository } from '../../repository/owner/owner.repository';
import { cacheService } from '../../utils/cache.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import {
  buildResidentImportTemplate,
  parseResidentImportCsv,
  ResidentImportCsvRow,
} from '../../utils/resident-import.util';
import { normalizePagination, createPaginatedResponse } from '../../utils/pagination.util';

export const RESIDENT_IMPORT_MAX_ROWS = 2000;
export const RESIDENT_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const RESIDENT_IMPORT_MAX_ACTIVE_PER_OWNER = 3;
export const RESIDENT_IMPORT_MONTHLY_ROW_BUDGET = 10000;

export interface ResidentImportJobPayload {
  importId: string;
  hostelId: string;
  ownerId: string;
  requestedByRole: string;
  rows: ResidentImportCsvRow[];
  hostelName?: string | undefined;
}

export interface ServiceResult<T> {
  data?: T | undefined;
  error?: { status: number; message: string; details?: unknown } | undefined;
}

export class ResidentImportService {
  constructor(
    private readonly importRepository: ResidentImportRepository = new ResidentImportRepository(),
    private readonly ownerRepository: OwnerRepository = new OwnerRepository(),
  ) {}

  public getTemplate(): { fileName: string; content: string; contentType: string } {
    return {
      fileName: 'resident-import-template.csv',
      content: buildResidentImportTemplate(),
      contentType: 'text/csv',
    };
  }

  public getPlanLimits(): {
    maxRowsPerFile: number;
    maxFileBytes: number;
    maxConcurrentImports: number;
    monthlyRowBudget: number;
    columns: string[];
  } {
    return {
      maxRowsPerFile: RESIDENT_IMPORT_MAX_ROWS,
      maxFileBytes: RESIDENT_IMPORT_MAX_BYTES,
      maxConcurrentImports: RESIDENT_IMPORT_MAX_ACTIVE_PER_OWNER,
      monthlyRowBudget: RESIDENT_IMPORT_MONTHLY_ROW_BUDGET,
      columns: ['name', 'email', 'phone', 'room', 'bed', 'rent'],
    };
  }

  public async enqueueImport(input: {
    hostelId: string;
    ownerId: string;
    role: string;
    fileName: string;
    fileBuffer: Buffer;
    idempotencyKey?: string | undefined;
  }): Promise<ServiceResult<{ import: ResidentImport; replayed: boolean }>> {
    if (!input.fileBuffer || input.fileBuffer.length === 0) {
      return { error: { status: STATUS_CODE.BAD_REQUEST, message: 'CSV file is empty' } };
    }

    if (input.fileBuffer.length > RESIDENT_IMPORT_MAX_BYTES) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'CSV exceeds 5MB limit' },
      };
    }

    const hostel =
      input.role === IROLES.ADMIN
        ? await this.ownerRepository.findHostelById(input.hostelId)
        : await this.ownerRepository.findHostelByIdAndOwner(input.hostelId, input.ownerId);

    if (!hostel) {
      return {
        error: {
          status: STATUS_CODE.FORBIDDEN,
          message: 'You do not have permission to import residents into this hostel',
        },
      };
    }

    const idempotencyKey = (input.idempotencyKey ?? '').trim() || null;
    if (idempotencyKey) {
      const existing = await this.importRepository.findByIdempotency(
        input.hostelId,
        input.ownerId,
        idempotencyKey,
      );
      if (existing) return { data: { import: existing, replayed: true } };
    }

    const activeCount = await this.importRepository.countActiveToday(input.ownerId);
    if (activeCount >= RESIDENT_IMPORT_MAX_ACTIVE_PER_OWNER) {
      return {
        error: {
          status: STATUS_CODE.TOO_MANY_REQUESTS,
          message: 'Plan limit: only 3 concurrent imports allowed.',
        },
      };
    }

    const parsed = parseResidentImportCsv(input.fileBuffer);
    if (parsed.totalRows === 0) {
      return {
        error: {
          status: STATUS_CODE.BAD_REQUEST,
          message: parsed.failures[0]?.message ?? 'CSV file has no data rows',
          details: parsed.failures,
        },
      };
    }

    if (parsed.totalRows > RESIDENT_IMPORT_MAX_ROWS) {
      return {
        error: {
          status: STATUS_CODE.BAD_REQUEST,
          message: `Plan limit: max ${RESIDENT_IMPORT_MAX_ROWS} rows per file (got ${parsed.totalRows})`,
        },
      };
    }

    const checksum = crypto.createHash('sha256').update(input.fileBuffer).digest('hex');
    const record = this.importRepository.create({
      hostelId: input.hostelId,
      requestedBy: input.ownerId,
      fileName: input.fileName,
      status: parsed.rows.length === 0 ? ResidentImportStatus.FAILED : ResidentImportStatus.QUEUED,
      totalRows: parsed.totalRows,
      validRows: parsed.rows.length,
      successCount: 0,
      failedCount: parsed.failures.length,
      idempotencyKey,
      rowErrors: parsed.failures.slice(0, 100),
      failureReason: parsed.rows.length === 0 ? 'Every row failed validation' : null,
      completedAt: parsed.rows.length === 0 ? new Date() : null,
    });

    const saved = await this.importRepository.save(record);
    if (parsed.rows.length === 0) {
      await cacheService.invalidatePattern('owner:resident-imports');
      return { data: { import: saved, replayed: false } };
    }

    const payload: ResidentImportJobPayload = {
      importId: saved.id,
      hostelId: input.hostelId,
      ownerId: input.ownerId,
      requestedByRole: input.role,
      rows: parsed.rows,
      hostelName: hostel.name,
    };

    await residentImportQueue.add(JobType.RESIDENT_CSV_IMPORT, payload, {
      jobId: `resident-import-${saved.id}`,
      attempts: 3,
    });

    await eventDispatcher
      .queueNotification({
        userId: input.ownerId,
        hostelId: input.hostelId,
        title: 'Resident import queued',
        message: `${saved.fileName}: ${saved.validRows}/${saved.totalRows} rows queued (sha256:${checksum.slice(0, 12)}).`,
        type: 'RESIDENT_IMPORT_QUEUED',
        data: { importId: saved.id, checksum },
      })
      .catch(() => undefined);

    await cacheService.invalidatePattern('owner:resident-imports');
    return { data: { import: saved, replayed: false } };
  }

  public async getHistory(input: {
    ownerId: string;
    role: string;
    page: number;
    limit: number;
    hostelId?: string | undefined;
  }): Promise<ServiceResult<ReturnType<typeof createPaginatedResponse<ResidentImport>>>> {
    const { page, limit } = normalizePagination({ page: input.page, limit: input.limit });
    const cacheKey = cacheService.generateKey('owner:resident-imports', {
      ownerId: input.ownerId,
      hostelId: input.hostelId ?? 'all',
      page,
      limit,
      v: 1,
    });

    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        if (input.role === IROLES.ADMIN && input.hostelId) {
          const [list, total] = await this.importRepository.findHistoryByHostel(
            input.hostelId,
            page,
            limit,
          );
          return { list, total };
        }

        const [list, total] = await this.importRepository.findHistoryByOwner(
          input.ownerId,
          page,
          limit,
          input.hostelId,
        );
        return { list, total };
      },
      { l1TtlSeconds: 15, l2TtlSeconds: 60 },
    );

    return {
      data: {
        ...createPaginatedResponse(
          data.list,
          data.total,
          { page, limit },
          { isCached, cacheLevel },
        ),
      },
    };
  }

  public async getDetail(input: {
    importId: string;
    ownerId: string;
    role: string;
  }): Promise<ServiceResult<ResidentImport>> {
    const record = await this.importRepository.findById(input.importId);
    if (!record) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Import not found' } };
    }

    if (input.role !== IROLES.ADMIN && record.requestedBy !== input.ownerId) {
      return { error: { status: STATUS_CODE.FORBIDDEN, message: 'Cannot view this import' } };
    }

    return { data: record };
  }

  public async getImportDetail(input: {
    importId: string;
    ownerId: string;
    role: string;
  }): Promise<ServiceResult<ResidentImport>> {
    return this.getDetail(input);
  }
}

export const residentImportService = new ResidentImportService();
