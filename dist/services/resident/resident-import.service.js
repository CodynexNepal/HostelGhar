"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.residentImportService = exports.ResidentImportService = exports.RESIDENT_IMPORT_ROW_BUDGET = exports.RESIDENT_IMPORT_MAX_ACTIVE = exports.RESIDENT_IMPORT_MAX_BYTES = exports.RESIDENT_IMPORT_MAX_ROWS = void 0;
// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident-import.service.ts
// PURPOSE: Orchestrates background CSV resident imports (validate + enqueue,
//          history, plan limits). Worker creates residents transactionally.
// ──────────────────────────────────────────────────────────────────────────────
const crypto_1 = __importDefault(require("crypto"));
const queue_factory_1 = require("../../queue/queue.factory");
const queue_constants_1 = require("../../constant/queue.constants");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const roles_enum_1 = require("../../enum/roles.enum");
const resident_import_entity_1 = require("../../entities/import/resident-import.entity");
const resident_import_repository_1 = require("../../repository/import/resident-import.repository");
const owner_repository_1 = require("../../repository/owner/owner.repository");
const cache_util_1 = require("../../utils/cache.util");
const brotli_util_1 = require("../../utils/brotli.util");
const event_dispatcher_util_1 = require("../../utils/event-dispatcher.util");
const resident_import_util_1 = require("../../utils/resident-import.util");
const pagination_util_1 = require("../../utils/pagination.util");
const resident_import_util_2 = require("../../utils/resident-import.util");
exports.RESIDENT_IMPORT_MAX_ROWS = 2000;
exports.RESIDENT_IMPORT_MAX_BYTES = 5242880;
exports.RESIDENT_IMPORT_MAX_ACTIVE = 3;
exports.RESIDENT_IMPORT_ROW_BUDGET = 10000;
class ResidentImportService {
    constructor(importRepository = new resident_import_repository_1.ResidentImportRepository(), ownerRepository = new owner_repository_1.OwnerRepository()) {
        this.importRepository = importRepository;
        this.ownerRepository = ownerRepository;
    }
    getTemplate() {
        return {
            fileName: 'resident-import-template.csv',
            content: (0, resident_import_util_1.buildResidentImportTemplate)(),
            contentType: 'text/csv',
        };
    }
    getPlanLimits() {
        return {
            maxRowsPerFile: exports.RESIDENT_IMPORT_MAX_ROWS,
            maxFileBytes: exports.RESIDENT_IMPORT_MAX_BYTES,
            maxConcurrentImports: exports.RESIDENT_IMPORT_MAX_ACTIVE,
            monthlyRowBudget: exports.RESIDENT_IMPORT_ROW_BUDGET,
            columns: ['name', 'email', 'phone', 'room', 'bed', 'rent'],
        };
    }
    async enqueueImport(input) {
        if (!input.fileBuffer || input.fileBuffer.length === 0) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'CSV file is empty' } };
        }
        if (input.fileBuffer.length > exports.RESIDENT_IMPORT_MAX_BYTES) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST, message: 'CSV exceeds 5MB limit' } };
        }
        const isAdmin = input.role === roles_enum_1.IROLES.ADMIN;
        const hostel = isAdmin
            ? await this.ownerRepository.findHostelById(input.hostelId)
            : await this.ownerRepository.findHostelByIdAndOwner(input.hostelId, input.ownerId);
        if (!hostel) {
            return {
                error: {
                    status: statusCode_interface_1.STATUS_CODE.FORBIDDEN,
                    message: 'You do not have permission to import into this hostel',
                },
            };
        }
        const key = (input.idempotencyKey ?? '').trim() || null;
        if (key) {
            const existing = await this.importRepository.findByIdempotency(input.hostelId, input.ownerId, key);
            if (existing)
                return { data: { import: existing, replayed: true } };
        }
        const active = await this.importRepository.countActiveToday(input.ownerId);
        if (active >= exports.RESIDENT_IMPORT_MAX_ACTIVE) {
            return {
                error: { status: statusCode_interface_1.STATUS_CODE.TOO_MANY_REQUESTS, message: 'Only 3 concurrent imports.' },
            };
        }
        const parsed = (0, resident_import_util_2.parseResidentImportCsv)(input.fileBuffer);
        if (parsed.totalRows === 0) {
            return {
                error: {
                    status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST,
                    message: parsed.failures[0]?.message ?? 'CSV has no data rows',
                    details: parsed.failures,
                },
            };
        }
        if (parsed.totalRows > exports.RESIDENT_IMPORT_MAX_ROWS) {
            return {
                error: {
                    status: statusCode_interface_1.STATUS_CODE.BAD_REQUEST,
                    message: `Max ${exports.RESIDENT_IMPORT_MAX_ROWS} rows per file (got ${parsed.totalRows})`,
                },
            };
        }
        const checksum = crypto_1.default.createHash('sha256').update(input.fileBuffer).digest('hex');
        const rec = this.importRepository.create({
            hostelId: input.hostelId,
            requestedBy: input.ownerId,
            fileName: input.fileName,
            status: parsed.rows.length === 0 ? resident_import_entity_1.ResidentImportStatus.FAILED : resident_import_entity_1.ResidentImportStatus.QUEUED,
            totalRows: parsed.totalRows,
            validRows: parsed.rows.length,
            successCount: 0,
            failedCount: parsed.failures.length,
            idempotencyKey: key,
            rowErrors: parsed.failures.slice(0, 100),
            failureReason: parsed.rows.length === 0 ? 'Every row failed validation' : null,
            completedAt: parsed.rows.length === 0 ? new Date() : null,
        });
        const saved = await this.importRepository.save(rec);
        if (parsed.rows.length === 0) {
            await cache_util_1.cacheService.invalidatePattern('owner:resident-imports');
            return { data: { import: saved, replayed: false } };
        }
        const payload = (0, brotli_util_1.packQueueRows)({
            importId: saved.id,
            hostelId: input.hostelId,
            ownerId: input.ownerId,
            requestedByRole: input.role,
            rows: parsed.rows,
            hostelName: hostel.name,
        });
        await queue_factory_1.residentImportQueue.add(queue_constants_1.JobType.RESIDENT_CSV_IMPORT, payload, {
            jobId: `resident-import-${saved.id}`,
            attempts: 3,
        });
        await event_dispatcher_util_1.eventDispatcher
            .queueNotification({
            userId: input.ownerId,
            hostelId: input.hostelId,
            title: 'Resident import queued',
            message: `${saved.fileName}: ${saved.validRows}/${saved.totalRows} rows queued (${checksum.slice(0, 12)}).`,
            type: 'RESIDENT_IMPORT_QUEUED',
            data: { importId: saved.id, checksum },
        })
            .catch(() => undefined);
        await cache_util_1.cacheService.invalidatePattern('owner:resident-imports');
        return { data: { import: saved, replayed: false } };
    }
    async getHistory(input) {
        const pg = (0, pagination_util_1.normalizePagination)({ page: input.page, limit: input.limit });
        const cacheKey = cache_util_1.cacheService.generateKey('owner:resident-imports', {
            ownerId: input.ownerId,
            hostelId: input.hostelId ?? 'all',
            page: pg.page,
            limit: pg.limit,
            v: 1,
        });
        const wrapped = await cache_util_1.cacheService.wrap(cacheKey, async () => {
            if (input.role === roles_enum_1.IROLES.ADMIN && input.hostelId) {
                const [list, total] = await this.importRepository.findHistoryByHostel(input.hostelId, pg.page, pg.limit);
                return { list, total };
            }
            const [list, total] = await this.importRepository.findHistoryByOwner(input.ownerId, pg.page, pg.limit, input.hostelId);
            return { list, total };
        }, { l1TtlSeconds: 15, l2TtlSeconds: 60 });
        return {
            data: {
                ...(0, pagination_util_1.createPaginatedResponse)(wrapped.data.list, wrapped.data.total, pg, {
                    isCached: wrapped.isCached,
                    cacheLevel: wrapped.cacheLevel,
                }),
            },
        };
    }
    async getDetail(input) {
        const rec = await this.importRepository.findById(input.importId);
        if (!rec)
            return { error: { status: statusCode_interface_1.STATUS_CODE.NOT_FOUND, message: 'Import not found' } };
        if (input.role !== roles_enum_1.IROLES.ADMIN && rec.requestedBy !== input.ownerId) {
            return { error: { status: statusCode_interface_1.STATUS_CODE.FORBIDDEN, message: 'Cannot view this import' } };
        }
        return { data: rec };
    }
}
exports.ResidentImportService = ResidentImportService;
exports.residentImportService = new ResidentImportService();
