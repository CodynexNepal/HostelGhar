"use strict";
// ─────────────────────────────────────────────────────────────
// FILE: invoice.service.ts
// PURPOSE: Manual hostel-scoped invoice creation (Draft vs Send-now).
// ─────────────────────────────────────────────────────────────
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceService = void 0;
const database_source_1 = require("../../database/database-source");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const resident_entity_1 = require("../../entities/resident/resident.entity");
const fee_enum_1 = require("../../enum/fee.enum");
const fee_repository_1 = require("../../repository/fee/fee.repository");
const createHttpError_1 = require("../../utils/createHttpError");
const cache_util_1 = require("../../utils/cache.util");
const invoice_parse_service_1 = require("./invoice-parse.service");
const asText = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
};
class InvoiceService {
    constructor(feeRepository = new fee_repository_1.FeeRepository()) {
        this.feeRepository = feeRepository;
    }
    async createInvoice(actorId, role, dto) {
        void role;
        if (!dto.hostelId)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'hostelId is required');
        const { authorizeInvoiceHostel } = await Promise.resolve().then(() => __importStar(require('./invoice-authorize.service')));
        const hostel = await authorizeInvoiceHostel(actorId, role, dto.hostelId);
        const resident = await this.resolveResident(dto, dto.hostelId);
        const { month, year } = (0, invoice_parse_service_1.parseInvoiceBillingPeriod)(dto.billingMonth, dto.billingYear);
        const dueDate = (0, invoice_parse_service_1.parseInvoiceDueDate)(asText(dto.dueDate) ?? asText(dto.due_date) ?? '');
        const amount = this.resolveAmount(dto);
        const sendMode = (0, invoice_parse_service_1.resolveInvoiceSendMode)(dto);
        const existing = await this.feeRepository.findMonthlyFee(resident.id, month, year);
        if (existing) {
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.CONFLICT, `Invoice already exists for this resident for ${month}/${year}`);
        }
        const outstandingDue = await this.outstandingFor(resident.id);
        const totalPayable = Math.round((amount + outstandingDue) * 100) / 100;
        const fee = await this.feeRepository.createFee({
            residentId: resident.id,
            hostelId: dto.hostelId,
            feeType: fee_enum_1.FeeType.MONTHLY_HOSTEL_FEE,
            amount,
            dueAmount: outstandingDue,
            totalPayable,
            paidAmount: 0,
            billingMonth: month,
            billingYear: year,
            dueDate,
            status: fee_enum_1.FeeStatus.PENDING,
        });
        const full = await this.feeRepository.findById(fee.id);
        if (!full)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.INTERNAL_SERVER_ERROR, 'Invoice was created but could not be reloaded');
        await this.invalidateInvoiceCaches(dto.hostelId);
        if (sendMode === 'DRAFT') {
            return { fee: full, emailSent: false, emailQueuedTo: null, sendMode };
        }
        const { sendInvoiceEmail } = await Promise.resolve().then(() => __importStar(require('./invoice-email.service')));
        const queuedTo = await sendInvoiceEmail({
            fee: full,
            resident,
            hostel,
            billingMonth: month,
            billingYear: year,
            amount,
            outstandingDue,
            totalPayable,
            dueDate,
            isDraftPreview: false,
            actorId,
            residentEmail: dto.residentEmail,
        });
        return {
            fee: full,
            emailSent: queuedTo !== null,
            emailQueuedTo: queuedTo,
            sendMode,
        };
    }
    resolveAmount(dto) {
        const candidates = [dto.amount, dto.total, dto.totalPayable];
        for (const candidate of candidates) {
            if (candidate === undefined || candidate === null || candidate === '')
                continue;
            const num = Number(candidate);
            if (!Number.isFinite(num) || num <= 0) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'amount must be a positive number');
            }
            return Math.round(num * 100) / 100;
        }
        throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'amount is required');
    }
    async outstandingFor(residentId) {
        const pending = await this.feeRepository.findPendingFeesByResident(residentId);
        const sum = pending.reduce((total, fee) => total + (Number(fee.totalPayable) - Number(fee.paidAmount)), 0);
        return Math.max(Math.round(sum * 100) / 100, 0);
    }
    async resolveResident(dto, hostelId) {
        const repo = database_source_1.AppDataSource.getRepository(resident_entity_1.Resident);
        if (dto.residentId) {
            const resident = await repo.findOne({
                where: { id: dto.residentId },
                relations: { user: true, hostel: true },
            });
            if (!resident)
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.NOT_FOUND, 'Resident not found');
            if (resident.hostelId !== hostelId) {
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Resident does not belong to this hostel');
            }
            if (!resident.isActive)
                throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'Resident is not active');
            return resident;
        }
        const name = asText(dto.residentName) ?? asText(dto.resident_name);
        if (!name)
            throw (0, createHttpError_1.createHttpError)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST, 'residentId or residentName is required');
        const { findResidentByName } = await Promise.resolve().then(() => __importStar(require('./invoice-resident.service')));
        return findResidentByName(hostelId, name);
    }
    async invalidateInvoiceCaches(hostelId) {
        await Promise.all([
            cache_util_1.cacheService.invalidatePattern('hostel:fees'),
            cache_util_1.cacheService.invalidatePattern('resident:fees'),
            cache_util_1.cacheService.invalidatePattern('owner:dashboard'),
            cache_util_1.cacheService.invalidatePattern('analytics:owner'),
            cache_util_1.cacheService.invalidatePattern(`hostel:fees:${hostelId}`),
        ]);
    }
}
exports.InvoiceService = InvoiceService;
