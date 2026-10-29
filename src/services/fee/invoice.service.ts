// ─────────────────────────────────────────────────────────────
// FILE: invoice.service.ts
// PURPOSE: Manual hostel-scoped invoice creation (Draft vs Send-now).
// ─────────────────────────────────────────────────────────────

import { AppDataSource } from '../../database/database-source';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CreateInvoiceDto } from '../../dto/fee/create-invoice.dto';
import { Resident } from '../../entities/resident/resident.entity';
import { FeeStatus, FeeType } from '../../enum/fee.enum';
import { FeeRepository } from '../../repository/fee/fee.repository';
import { createHttpError } from '../../utils/createHttpError';
import { cacheService } from '../../utils/cache.util';
import {
  parseInvoiceBillingPeriod,
  parseInvoiceDueDate,
  resolveInvoiceSendMode,
} from './invoice-parse.service';
import { CreateInvoiceResult } from './invoice-result.type';

const asText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class InvoiceService {
  constructor(private readonly feeRepository = new FeeRepository()) {}

  public async createInvoice(
    actorId: string,
    role: string,
    dto: CreateInvoiceDto,
  ): Promise<CreateInvoiceResult> {
    void role;
    if (!dto.hostelId) throw createHttpError(STATUS_CODE.BAD_REQUEST, 'hostelId is required');
    const { authorizeInvoiceHostel } = await import('./invoice-authorize.service');
    const hostel = await authorizeInvoiceHostel(actorId, role, dto.hostelId);

    const resident = await this.resolveResident(dto, dto.hostelId);
    const { month, year } = parseInvoiceBillingPeriod(dto.billingMonth, dto.billingYear);
    const dueDate = parseInvoiceDueDate(asText(dto.dueDate) ?? asText(dto.due_date) ?? '');
    const amount = this.resolveAmount(dto);
    const sendMode = resolveInvoiceSendMode(dto);

    const existing = await this.feeRepository.findMonthlyFee(resident.id, month, year);
    if (existing) {
      throw createHttpError(
        STATUS_CODE.CONFLICT,
        `Invoice already exists for this resident for ${month}/${year}`,
      );
    }

    const outstandingDue = await this.outstandingFor(resident.id);
    const totalPayable = Math.round((amount + outstandingDue) * 100) / 100;

    const fee = await this.feeRepository.createFee({
      residentId: resident.id,
      hostelId: dto.hostelId,
      feeType: FeeType.MONTHLY_HOSTEL_FEE,
      amount,
      dueAmount: outstandingDue,
      totalPayable,
      paidAmount: 0,
      billingMonth: month,
      billingYear: year,
      dueDate,
      status: FeeStatus.PENDING,
    });

    const full = await this.feeRepository.findById(fee.id);
    if (!full)
      throw createHttpError(
        STATUS_CODE.INTERNAL_SERVER_ERROR,
        'Invoice was created but could not be reloaded',
      );

    await this.invalidateInvoiceCaches(dto.hostelId);

    if (sendMode === 'DRAFT') {
      return { fee: full, emailSent: false, emailQueuedTo: null, sendMode };
    }

    const { sendInvoiceEmail } = await import('./invoice-email.service');
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

  private resolveAmount(dto: CreateInvoiceDto): number {
    const candidates: unknown[] = [dto.amount, dto.total, dto.totalPayable];
    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null || candidate === '') continue;
      const num = Number(candidate);
      if (!Number.isFinite(num) || num <= 0) {
        throw createHttpError(STATUS_CODE.BAD_REQUEST, 'amount must be a positive number');
      }
      return Math.round(num * 100) / 100;
    }
    throw createHttpError(STATUS_CODE.BAD_REQUEST, 'amount is required');
  }

  private async outstandingFor(residentId: string): Promise<number> {
    const pending = await this.feeRepository.findPendingFeesByResident(residentId);
    const sum = pending.reduce(
      (total, fee) => total + (Number(fee.totalPayable) - Number(fee.paidAmount)),
      0,
    );
    return Math.max(Math.round(sum * 100) / 100, 0);
  }

  private async resolveResident(dto: CreateInvoiceDto, hostelId: string): Promise<Resident> {
    const repo = AppDataSource.getRepository(Resident);
    if (dto.residentId) {
      const resident = await repo.findOne({
        where: { id: dto.residentId },
        relations: { user: true, hostel: true },
      });
      if (!resident) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Resident not found');
      if (resident.hostelId !== hostelId) {
        throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Resident does not belong to this hostel');
      }
      if (!resident.isActive)
        throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Resident is not active');
      return resident;
    }
    const name = asText(dto.residentName) ?? asText(dto.resident_name);
    if (!name)
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'residentId or residentName is required');
    const { findResidentByName } = await import('./invoice-resident.service');
    return findResidentByName(hostelId, name);
  }

  private async invalidateInvoiceCaches(hostelId: string): Promise<void> {
    await Promise.all([
      cacheService.invalidatePattern('hostel:fees'),
      cacheService.invalidatePattern('resident:fees'),
      cacheService.invalidatePattern('owner:dashboard'),
      cacheService.invalidatePattern('analytics:owner'),
      cacheService.invalidatePattern(`hostel:fees:${hostelId}`),
    ]);
  }
}
