// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee.service.ts
// PURPOSE: Automated Student Fee lifecycle & Monthly billing cron jobs.
//          - Generates monthly fee of 10500 + previous due amount
//          - Queues emails via BullMQ with Circuit Breaker
//          - Emits live WebSocket updates to residents and owners
//          - 3-tier caching & pagination for fee lookups
// ──────────────────────────────────────────────────────────────────────────────

import { FeeStatus, FeeType } from '../../enum/fee.enum';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { JobType, SocketEvent } from '../../constant/queue.constants';
import { FeeRepository } from '../../repository/fee/fee.repository';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { createPaginatedResponse } from '../../utils/pagination.util';
import { renderMonthlyFeeBillEmail } from '../../templates/email.template';
import { applyPaymentToFeeAmounts } from '../../utils/fee-credit.util';
import { socketServer } from '../../socket/socket.server';
import {
  formatNepaliDate,
  formatNepaliMonthYear,
  getBsMonthLength,
  isFirstDayOfNepaliMonth,
  toNepaliDate,
} from '../../utils/nepali-date.util';

export interface NepaliBillingPeriod {
  bsYear: number;
  bsMonth: number;
  nepaliMonthLabel: string;
  nepaliDateLabel: string;
  billingMonth: number;
  billingYear: number;
  dueDate: string;
  dueDateBs: string;
}

/**
 * Billing is stored on the AD calendar (billingMonth/billingYear/dueDate) so
 * existing reports keep working, but the whole cycle is keyed to the Nepali
 * 1st: the BS month/year become the customer-facing bill identity.
 */
export const resolveNepaliBillingPeriod = (now: Date = new Date()): NepaliBillingPeriod => {
  const bs = toNepaliDate(now);
  const nepaliMonthLabel = formatNepaliMonthYear(bs);
  const nepaliDateLabel = formatNepaliDate({ year: bs.year, month: bs.month, day: 1 });
  const billingMonth = now.getMonth() + 1;
  const billingYear = now.getFullYear();
  const dueDate = `${billingYear}-${String(billingMonth).padStart(2, '0')}-07`;
  const dueDay = Math.min(7, getBsMonthLength(bs.year, bs.month));
  const dueDateBs = formatNepaliDate({ year: bs.year, month: bs.month, day: dueDay });
  return { bsYear: bs.year, bsMonth: bs.month, nepaliMonthLabel, nepaliDateLabel, billingMonth, billingYear, dueDate, dueDateBs };
};

export class FeeService {
  constructor(private readonly feeRepository: FeeRepository = new FeeRepository()) {}

  /**
   * Generates monthly fee for all active residents across all hostels.
   * Run automatically on the 1st day of every NEPALI month.
   * When `enforceNepaliFirstDay` is true (scheduler path), the run is skipped
   * unless today is Baishakh 1, Jestha 1, ... (gatey).
   */
  public async generateMonthlyFeesForAllHostels(
    billingMonth?: number,
    billingYear?: number,
    baseFee: number = 10500.0,
    options: { enforceNepaliFirstDay?: boolean; now?: Date } = {},
  ): Promise<{ generatedCount: number; errors: number; skipped?: boolean; nepaliMonth?: string }> {
    const now = options.now ?? new Date();
    if (options.enforceNepaliFirstDay && !isFirstDayOfNepaliMonth(now)) {
      return { generatedCount: 0, errors: 0, skipped: true };
    }

    const period = resolveNepaliBillingPeriod(now);
    const resolvedMonth = billingMonth ?? period.billingMonth;
    const resolvedYear = billingYear ?? period.billingYear;
    const dueDate = `${resolvedYear}-${String(resolvedMonth).padStart(2, '0')}-07`;
    console.log(
      `🏦 [FeeService] Starting Nepali monthly fee automation for ${period.nepaliMonthLabel} (AD ${resolvedMonth}/${resolvedYear})...`,
    );

    // Stream/batch active residents with user details and hostel owner details
    const activeResidents = await this.feeRepository.findActiveResidents();

    let generatedCount = 0;
    let errors = 0;

    for (const resident of activeResidents) {
      try {
        // 1. Calculate any outstanding unpaid / overdue balance from previous billing cycles
        const previousUnpaidFees = await this.feeRepository.findPendingFeesByResident(resident.id);

        const outstandingDue = previousUnpaidFees.reduce(
          (sum, f) => sum + (Number(f.totalPayable) - Number(f.paidAmount)),
          0,
        );

        const totalPayable = Number(baseFee) + Number(outstandingDue);

        // 2. Check if monthly bill already exists
        let feeRecord = await this.feeRepository.findMonthlyFee(
          resident.id,
          resolvedMonth,
          resolvedYear,
        );

        if (!feeRecord) {
          feeRecord = await this.feeRepository.createFee({
            residentId: resident.id,
            hostelId: resident.hostelId,
            feeType: FeeType.MONTHLY_HOSTEL_FEE,
            amount: baseFee,
            dueAmount: outstandingDue,
            totalPayable: totalPayable,
            paidAmount: 0.0,
            billingMonth: resolvedMonth,
            billingYear: resolvedYear,
            dueDate,
            status: FeeStatus.PENDING,
          });
          generatedCount++;
        }

        // Invalidate fee caches across all tiers.
        // NOTE: keys are `cache:<prefix>:<json>` so a suffixed pattern like
        // `hostel:fees:<hostelId>` never matches — invalidate by prefix.
        await cacheService.invalidatePattern(`resident:fees`);
        await cacheService.invalidatePattern(`hostel:fees`);
        await cacheService.invalidatePattern(`hostel:residents`);
        await cacheService.invalidatePattern(`owner:dashboard`);
        await cacheService.invalidatePattern(`owner:residents`);

        // 3. Beautiful Nepali-month fee bill email (hostel + owner identity)
        const ownerName =
          `${resident.hostel.owner?.firstName || ''} ${resident.hostel.owner?.lastName || ''}`.trim() ||
          'Hostel Owner';
        const studentName =
          `${resident.user.firstName || ''} ${resident.user.lastName || ''}`.trim() || 'Student';
        const bill = renderMonthlyFeeBillEmail({
          studentName,
          studentEmail: resident.user.email,
          hostelName: resident.hostel.name,
          ownerName,
          hostelAddress: resident.hostel.address,
          hostelPhone: resident.hostel.phone,
          hostelEmail: resident.hostel.email,
          roomNumber: resident.roomNumber,
          nepaliMonthLabel: period.nepaliMonthLabel,
          nepaliDateLabel: period.nepaliDateLabel,
          baseFee: Number(baseFee),
          outstandingDue: Number(outstandingDue),
          totalPayable: Number(totalPayable),
          dueDateAd: dueDate,
          dueDateBs: period.dueDateBs,
          billNo: feeRecord.id.slice(0, 8).toUpperCase(),
        });

        await eventDispatcher.queueEmail(JobType.SEND_INVOICE_EMAIL, {
          to: resident.user.email,
          subject: bill.subject,
          body: bill.body,
          html: bill.html,
        });

        // 4. Live Push Notification via Socket.io to the resident
        socketServer.toUser(resident.userId, SocketEvent.PAYMENT_PROCESSED, {
          title: 'Monthly Fee Generated',
          message: `Your ${period.nepaliMonthLabel} hostel fee of NPR ${baseFee} (Total due: NPR ${totalPayable}) is due by ${dueDate}.`,
          feeId: feeRecord.id,
          totalPayable,
        });
      } catch (err: any) {
        console.error(
          `❌ [FeeService] Error generating fee for resident ${resident.id}:`,
          err.message,
        );
        errors++;
      }
    }

    console.log(
      `✅ [FeeService] Fee automation completed for ${period.nepaliMonthLabel}. Generated: ${generatedCount}, Errors: ${errors}`,
    );
    return { generatedCount, errors, nepaliMonth: period.nepaliMonthLabel };
  }

  public async listHostelFees(hostelId: string, page: number = 1, limit: number = 20) {
    const cacheKey = cacheService.generateKey('hostel:fees', { hostelId, page, limit });

    // 3-Level Cache: L1 (LRU RAM) -> L2 (Redis) -> L3 (DB)
    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        const [fees, total] = await this.feeRepository.findByHostel(hostelId, page, limit);
        return { fees, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );

    return createPaginatedResponse(
      data.fees,
      data.total,
      { page, limit },
      { isCached, cacheLevel },
    );
  }

  public async recordPayment(feeId: string, paidAmount: number, actorId: string) {
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'paidAmount must be a positive number' },
      };
    }

    const fee = await this.feeRepository.findById(feeId);
    if (!fee) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Fee not found' } };
    }

    // Same credit math as proof approval: clamped to the outstanding balance,
    // so a manual payment can never overpay or leave a stale PENDING status.
    const result = applyPaymentToFeeAmounts(
      {
        totalPayable: Number(fee.totalPayable),
        paidAmount: Number(fee.paidAmount),
        status: fee.status,
      },
      paidAmount,
    );
    fee.paidAmount = result.paidAmount;
    fee.status = result.status;
    if (result.paidAmount >= result.totalPayable) fee.dueAmount = 0;
    const savedFee = await this.feeRepository.saveFee(fee);

    // Invalidate fee caches across all tiers (prefix — keys hold JSON params).
    await cacheService.invalidatePattern(`resident:fees`);
    await cacheService.invalidatePattern(`hostel:fees`);
    await cacheService.invalidatePattern(`hostel:residents`);
    await cacheService.invalidatePattern(`owner:dashboard`);
    await cacheService.invalidatePattern(`owner:residents`);

    await eventDispatcher.dispatch({
      type: SocketEvent.PAYMENT_PROCESSED,
      payload: savedFee,
      userId: fee.resident.userId,
      hostelId: fee.hostelId,
      metadata: { actorId, feeId },
    });

    return { data: savedFee };
  }
}

export const feeService = new FeeService();
