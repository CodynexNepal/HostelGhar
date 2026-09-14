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
import { socketServer } from '../../socket/socket.server';
import { FeeRepository } from '../../repository/fee/fee.repository';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { cacheService } from '../../utils/cache.util';
import { createPaginatedResponse } from '../../utils/pagination.util';

export class FeeService {
  constructor(private readonly feeRepository: FeeRepository = new FeeRepository()) {}

  /**
   * Generates monthly fee for all active residents across all hostels
   * Run automatically on the 1st day of every month.
   */
  public async generateMonthlyFeesForAllHostels(
    billingMonth: number = new Date().getMonth() + 1,
    billingYear: number = new Date().getFullYear(),
    baseFee: number = 10500.0,
  ): Promise<{ generatedCount: number; errors: number }> {
    console.log(
      `🏦 [FeeService] Starting monthly fee automation for ${billingMonth}/${billingYear}...`,
    );

    // Stream/batch active residents with user details and hostel owner details
    const activeResidents = await this.feeRepository.findActiveResidents();

    let generatedCount = 0;
    let errors = 0;

    // Due date set to 7th of the month
    const dueDate = `${billingYear}-${String(billingMonth).padStart(2, '0')}-07`;

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
          billingMonth,
          billingYear,
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
            billingMonth,
            billingYear,
            dueDate,
            status: FeeStatus.PENDING,
          });
          generatedCount++;
        }

        // Invalidate fee caches across all tiers
        await cacheService.invalidatePattern(`resident:fees:${resident.id}`);
        await cacheService.invalidatePattern(`hostel:fees:${resident.hostelId}`);

        // 3. Dispatch automated email notification via BullMQ with Circuit Breaker & Exponential Backoff
        const ownerName = resident.hostel.owner
          ? `${resident.hostel.owner.firstName} ${resident.hostel.owner.lastName}`
          : resident.hostel.name;

        const emailSubject = `Monthly Hostel Fee Notice - ${resident.hostel.name}`;
        const emailBody = `
          Dear ${resident.user.firstName} ${resident.user.lastName},

          This is a notification from ${ownerName} regarding your monthly hostel fee for ${billingMonth}/${billingYear}.

          • Base Monthly Fee: NPR ${baseFee.toFixed(2)}
          • Outstanding Due Amount: NPR ${outstandingDue.toFixed(2)}
          • Total Amount Payable: NPR ${totalPayable.toFixed(2)}
          • Due Date: ${dueDate}

          Please make the payment before the due date to avoid late penalty.

          Regards,
          ${resident.hostel.name} Management
        `;

        await eventDispatcher.queueEmail(JobType.SEND_INVOICE_EMAIL, {
          to: resident.user.email,
          subject: emailSubject,
          body: emailBody,
        });

        // 4. Live Push Notification via Socket.io to the resident
        socketServer.toUser(resident.userId, SocketEvent.PAYMENT_PROCESSED, {
          title: 'Monthly Fee Generated',
          message: `Your hostel fee of NPR ${baseFee} (Total due: NPR ${totalPayable}) is due by ${dueDate}.`,
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
      `✅ [FeeService] Fee automation completed. Generated: ${generatedCount}, Errors: ${errors}`,
    );
    return { generatedCount, errors };
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

    fee.paidAmount = Number(fee.paidAmount) + paidAmount;
    fee.status =
      fee.paidAmount >= Number(fee.totalPayable) ? FeeStatus.PAID : FeeStatus.PARTIALLY_PAID;
    const savedFee = await this.feeRepository.saveFee(fee);

    // Invalidate fee caches across all tiers
    await cacheService.invalidatePattern(`resident:fees:${fee.residentId}`);
    await cacheService.invalidatePattern(`hostel:fees:${fee.hostelId}`);

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
