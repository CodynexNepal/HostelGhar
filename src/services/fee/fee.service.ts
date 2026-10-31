// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee.service.ts
// PURPOSE: Automated Student Fee lifecycle & Monthly billing cron jobs.
//          - Generates monthly fee of 10500 + previous due amount
//          - Queues emails via BullMQ with Circuit Breaker
//          - Emits live WebSocket updates to residents and owners
//          - 3-tier caching & pagination for fee lookups
// ──────────────────────────────────────────────────────────────────────────────

import { FeeStatus, FeeType } from '../../enum/fee.enum';
import { Fee } from '../../entities/fee/fee.entity';
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
  return {
    bsYear: bs.year,
    bsMonth: bs.month,
    nepaliMonthLabel,
    nepaliDateLabel,
    billingMonth,
    billingYear,
    dueDate,
    dueDateBs,
  };
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
    options: {
      enforceNepaliFirstDay?: boolean;
      now?: Date;
      hostelId?: string;
      resendEmails?: boolean;
    } = {},
  ): Promise<{
    generatedCount: number;
    errors: number;
    skipped?: boolean;
    nepaliMonth?: string;
    emailsDispatched?: number;
    message?: string;
  }> {
    const now = options.now ?? new Date();
    if (options.enforceNepaliFirstDay && !isFirstDayOfNepaliMonth(now)) {
      return { generatedCount: 0, errors: 0, skipped: true };
    }

    const period = resolveNepaliBillingPeriod(now);
    const resolvedMonth = billingMonth ?? period.billingMonth;
    const resolvedYear = billingYear ?? period.billingYear;
    const dueDate = `${resolvedYear}-${String(resolvedMonth).padStart(2, '0')}-07`;
    console.log(
      `🏦 [FeeService] Starting Nepali monthly fee automation for ${period.nepaliMonthLabel} (AD ${resolvedMonth}/${resolvedYear})${options.hostelId ? ` for hostel ${options.hostelId}` : ''}...`,
    );

    // Stream/batch active residents with user details and hostel owner details in a single query
    const activeResidents = await this.feeRepository.findActiveResidents(options.hostelId);
    if (activeResidents.length === 0) {
      return {
        generatedCount: 0,
        errors: 0,
        nepaliMonth: period.nepaliMonthLabel,
        emailsDispatched: 0,
      };
    }

    const residentIds = activeResidents.map((r) => r.id);

    // 1. Single batch query for already-generated monthly fees in this period (prevents N lookups)
    const existingFees = await this.feeRepository.findExistingMonthlyFees(
      residentIds,
      resolvedMonth,
      resolvedYear,
    );
    const alreadyBilledSet = new Set(existingFees.map((f) => f.residentId));

    // 2. Filter out residents who have already been billed for this cycle
    const unbilledResidents = activeResidents.filter((r) => !alreadyBilledSet.has(r.id));
    if (unbilledResidents.length === 0) {
      console.log(
        `🏦 [FeeService] All active residents already billed for ${period.nepaliMonthLabel}.`,
      );

      if (options.resendEmails) {
        const existingMap = new Map(existingFees.map((f) => [f.residentId, f]));
        const resendJobs: Array<{
          name: JobType;
          data: {
            to: string;
            subject: string;
            body?: string;
            html?: string;
          };
        }> = [];

        for (const resident of activeResidents) {
          const fee = existingMap.get(resident.id);
          if (!fee || !resident.user?.email) continue;
          const ownerName =
            `${resident.hostel?.owner?.firstName || ''} ${resident.hostel?.owner?.lastName || ''}`.trim() ||
            'Hostel Owner';
          const studentName =
            `${resident.user?.firstName || ''} ${resident.user?.lastName || ''}`.trim() ||
            'Student';

          const bill = renderMonthlyFeeBillEmail({
            studentName,
            studentEmail: resident.user?.email,
            hostelName: resident.hostel?.name || 'Hostel',
            ownerName,
            hostelAddress: resident.hostel?.address || '',
            hostelPhone: resident.hostel?.phone || '',
            hostelEmail: resident.hostel?.email || '',
            roomNumber: resident.roomNumber,
            nepaliMonthLabel: period.nepaliMonthLabel,
            nepaliDateLabel: period.nepaliDateLabel,
            baseFee: Number(fee.amount ?? baseFee),
            outstandingDue: Number(fee.dueAmount ?? 0),
            totalPayable: Number(fee.totalPayable ?? baseFee),
            dueDateAd: fee.dueDate || dueDate,
            dueDateBs: period.dueDateBs,
            billNo: `FEE-${resolvedYear}${String(resolvedMonth).padStart(2, '0')}`,
          });

          resendJobs.push({
            name: JobType.SEND_INVOICE_EMAIL,
            data: {
              to: resident.user.email,
              subject: bill.subject,
              body: bill.body,
              html: bill.html,
            },
          });
        }

        if (resendJobs.length > 0) {
          try {
            await eventDispatcher.queueEmailsBulk(resendJobs, { timeoutMs: 10000 });
          } catch (err: any) {
            console.warn('⚠️ [FeeService] Resend bulk email dispatch warning:', err.message);
          }
        }

        return {
          generatedCount: 0,
          errors: 0,
          nepaliMonth: period.nepaliMonthLabel,
          emailsDispatched: resendJobs.length,
          message: `All active residents were already billed. Resent ${resendJobs.length} bill email(s).`,
        };
      }

      return {
        generatedCount: 0,
        errors: 0,
        nepaliMonth: period.nepaliMonthLabel,
        emailsDispatched: 0,
      };
    }

    // 3. Single aggregate query for all pending/unpaid balances (eliminates N balance queries)
    const unbilledResidentIds = unbilledResidents.map((r) => r.id);
    const balances = await this.feeRepository.findPendingBalancesByResidents(unbilledResidentIds);

    const feesToCreate: Partial<Fee>[] = [];
    const emailJobs: Array<{
      name: JobType;
      data: {
        to: string;
        subject: string;
        body?: string;
        html?: string;
      };
    }> = [];
    const socketNotifications: Array<{
      userId: string;
      totalPayable: number;
    }> = [];

    for (const resident of unbilledResidents) {
      const outstandingDue = balances.get(resident.id) || 0.0;
      const totalPayable = Number(baseFee) + Number(outstandingDue);

      feesToCreate.push({
        residentId: resident.id,
        hostelId: resident.hostelId,
        feeType: FeeType.MONTHLY_HOSTEL_FEE,
        amount: baseFee,
        dueAmount: outstandingDue,
        totalPayable,
        paidAmount: 0.0,
        billingMonth: resolvedMonth,
        billingYear: resolvedYear,
        dueDate,
        status: FeeStatus.PENDING,
      });

      const ownerName =
        `${resident.hostel?.owner?.firstName || ''} ${resident.hostel?.owner?.lastName || ''}`.trim() ||
        'Hostel Owner';
      const studentName =
        `${resident.user?.firstName || ''} ${resident.user?.lastName || ''}`.trim() || 'Student';

      const bill = renderMonthlyFeeBillEmail({
        studentName,
        studentEmail: resident.user?.email,
        hostelName: resident.hostel?.name || 'Hostel',
        ownerName,
        hostelAddress: resident.hostel?.address || '',
        hostelPhone: resident.hostel?.phone || '',
        hostelEmail: resident.hostel?.email || '',
        roomNumber: resident.roomNumber,
        nepaliMonthLabel: period.nepaliMonthLabel,
        nepaliDateLabel: period.nepaliDateLabel,
        baseFee: Number(baseFee),
        outstandingDue: Number(outstandingDue),
        totalPayable: Number(totalPayable),
        dueDateAd: dueDate,
        dueDateBs: period.dueDateBs,
        billNo: `FEE-${resolvedYear}${String(resolvedMonth).padStart(2, '0')}`,
      });

      if (resident.user?.email) {
        emailJobs.push({
          name: JobType.SEND_INVOICE_EMAIL,
          data: {
            to: resident.user.email,
            subject: bill.subject,
            body: bill.body,
            html: bill.html,
          },
        });
      }

      if (resident.userId) {
        socketNotifications.push({
          userId: resident.userId,
          totalPayable,
        });
      }
    }

    let generatedCount = 0;
    let errors = 0;

    // 4. Chunked bulk insert inside a single database roundtrip
    try {
      const savedFees = await this.feeRepository.createFeesBulk(feesToCreate);
      generatedCount = savedFees.length;
    } catch (bulkErr: any) {
      console.error('❌ [FeeService] Error in bulk fee creation:', bulkErr.message);
      errors++;
      throw bulkErr;
    }

    // 5. Invalidate fee caches once in parallel across all tiers (NOT in the loop)
    await Promise.allSettled([
      cacheService.invalidatePattern('resident:fees'),
      cacheService.invalidatePattern('hostel:fees'),
      cacheService.invalidatePattern('hostel:residents'),
      cacheService.invalidatePattern('owner:dashboard'),
      cacheService.invalidatePattern('owner:residents'),
    ]);

    // 6. Bulk dispatch email jobs in a single Redis transaction / direct SMTP
    let emailsDispatched = 0;
    if (emailJobs.length > 0) {
      try {
        await eventDispatcher.queueEmailsBulk(emailJobs, { timeoutMs: 10000 });
        emailsDispatched = emailJobs.length;
      } catch (err: any) {
        console.warn('⚠️ [FeeService] Bulk email dispatch warning:', err.message);
      }
    }

    // 7. Dispatch real-time push notifications
    for (const notif of socketNotifications) {
      try {
        socketServer.toUser(notif.userId, SocketEvent.PAYMENT_PROCESSED, {
          title: 'Monthly Fee Generated',
          message: `Your ${period.nepaliMonthLabel} hostel fee of NPR ${baseFee} (Total due: NPR ${notif.totalPayable}) is due by ${dueDate}.`,
          totalPayable: notif.totalPayable,
        });
      } catch {
        // Non-blocking
      }
    }

    console.log(
      `✅ [FeeService] Fee automation completed for ${period.nepaliMonthLabel}. Generated: ${generatedCount}, Errors: ${errors}, Emails: ${emailsDispatched}`,
    );
    return { generatedCount, errors, nepaliMonth: period.nepaliMonthLabel, emailsDispatched };
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
    await this.invalidateFeeCaches();

    await eventDispatcher.dispatch({
      type: SocketEvent.PAYMENT_PROCESSED,
      payload: savedFee,
      userId: fee.resident.userId,
      hostelId: fee.hostelId,
      metadata: { actorId, feeId },
    });

    return { data: savedFee };
  }

  /**
   * PATCH /fees/:id/status — explicit owner/admin status override.
   *
   * Why this exists alongside PATCH /fees/:id/payment: clients already call
   * `/fees/:id/status` (booking/leave convention) e.g. to mark OVERDUE or to
   * correct a mislabelled row. Payment math still wins for the money fields:
   * a PAID status with an outstanding balance is repaired to fully-paid
   * (same settlement rule as proof approval), and a non-PAID status can
   * never claim `paidAmount >= totalPayable` — it is normalized to PAID.
   */
  public async updateFeeStatus(
    feeId: string,
    status: FeeStatus,
    actorId: string,
    paidAmount?: number,
  ) {
    if (!Object.values(FeeStatus).includes(status)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'Invalid fee status' },
      };
    }
    if (paidAmount !== undefined && (!Number.isFinite(paidAmount) || paidAmount <= 0)) {
      return {
        error: { status: STATUS_CODE.BAD_REQUEST, message: 'paidAmount must be a positive number' },
      };
    }

    const fee = await this.feeRepository.findById(feeId);
    if (!fee) {
      return { error: { status: STATUS_CODE.NOT_FOUND, message: 'Fee not found' } };
    }

    // Apply any accompanying payment first (clamped to the outstanding balance).
    const result = applyPaymentToFeeAmounts(
      {
        totalPayable: Number(fee.totalPayable),
        paidAmount: Number(fee.paidAmount),
        status: fee.status,
      },
      paidAmount ?? 0,
    );
    // paidAmount omitted / zero → applyPaymentToFeeAmounts settles the FULL
    // outstanding. For a pure status flip (e.g. PENDING → OVERDUE) that would
    // wrongly credit the bill, so keep the ledger untouched in that case.
    const keepLedger = paidAmount === undefined || !(paidAmount > 0);
    const nextPaidAmount = keepLedger ? Number(fee.paidAmount) : result.paidAmount;

    const total = Number(fee.totalPayable);
    const outstanding = Math.max(total - nextPaidAmount, 0);

    // Ledger truth wins: fully-paid money ⇒ PAID, outstanding ⇒ never PAID.
    // A PAID request on a bill with dues is treated as settlement (proof
    // approval behaves the same way); a non-PAID request on settled money
    // would lie on dashboards, so it normalizes back to PAID.
    let nextStatus = status;
    if (outstanding <= 0 && total > 0) {
      nextStatus = FeeStatus.PAID;
    } else if (outstanding > 0 && nextStatus === FeeStatus.PAID) {
      fee.paidAmount = total;
      fee.status = FeeStatus.PAID;
      fee.dueAmount = 0;
      const savedFee = await this.feeRepository.saveFee(fee);
      await this.invalidateFeeCaches();
      await eventDispatcher.dispatch({
        type: SocketEvent.PAYMENT_PROCESSED,
        payload: savedFee,
        userId: fee.resident.userId,
        hostelId: fee.hostelId,
        metadata: { actorId, feeId, status: nextStatus },
      });
      return { data: savedFee };
    }

    fee.paidAmount = nextPaidAmount;
    fee.status = nextStatus;
    if (nextStatus === FeeStatus.PAID) fee.dueAmount = 0;
    const savedFee = await this.feeRepository.saveFee(fee);
    await this.invalidateFeeCaches();

    await eventDispatcher.dispatch({
      type: SocketEvent.PAYMENT_PROCESSED,
      payload: savedFee,
      userId: fee.resident.userId,
      hostelId: fee.hostelId,
      metadata: { actorId, feeId, status: nextStatus },
    });

    return { data: savedFee };
  }

  private async invalidateFeeCaches(): Promise<void> {
    // Invalidate fee caches across all tiers (prefix — keys hold JSON params).
    await cacheService.invalidatePattern(`resident:fees`);
    await cacheService.invalidatePattern(`hostel:fees`);
    await cacheService.invalidatePattern(`hostel:residents`);
    await cacheService.invalidatePattern(`owner:dashboard`);
    await cacheService.invalidatePattern(`owner:residents`);
  }
}

export const feeService = new FeeService();
