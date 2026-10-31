// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.service.ts
// PURPOSE: Centralized business logic for partial payments, overdue management,
//          atomic payment transactions, idempotency, and financial auditing.
// ──────────────────────────────────────────────────────────────────────────────

import { AppDataSource } from '../../database/database-source';
import { Fee } from '../../entities/fee/fee.entity';
import { Payment } from '../../entities/payment/payment.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { FeeStatus } from '../../enum/fee.enum';
import { PaymentMethod, PaymentStatus } from '../../enum/payment.enum';
import { IROLES } from '../../enum/roles.enum';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { createHttpError } from '../../utils/createHttpError';
import {
  applyPaymentToFeeAmounts,
  calculatePaymentStatus,
  feeOutstandingAmount,
  roundMoney,
} from '../../utils/fee-credit.util';
import { cacheService } from '../../utils/cache.util';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { SocketEvent } from '../../constant/queue.constants';
import { notificationService } from '../notification/notification.service';
import { RecordPaymentDto } from '../../dto/payment/record-payment.dto';
import { PaymentListFilters, PaymentRepository } from '../../repository/payment/payment.repository';
import { createPaginatedResponse } from '../../utils/pagination.util';

export class PaymentService {
  constructor(private readonly paymentRepo = new PaymentRepository()) {}

  /**
   * Validates actor authorization for a hostel or fee resource.
   */
  private async authorizeHostel(actorId: string, role: string, hostelId: string): Promise<Hostel> {
    const normalizedRole = role.toLowerCase();
    const hostelRepo = AppDataSource.getRepository(Hostel);
    const hostel = await hostelRepo.findOne({
      where: { id: hostelId },
      relations: { owner: true },
    });

    if (!hostel) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Hostel not found');
    }

    if (normalizedRole === IROLES.ADMIN.toLowerCase()) {
      return hostel;
    }

    if (normalizedRole === IROLES.OWNER.toLowerCase() && hostel.ownerId === actorId) {
      return hostel;
    }

    throw createHttpError(
      STATUS_CODE.FORBIDDEN,
      'You are not authorized to perform payment operations for this hostel',
    );
  }

  /**
   * Atomically records a payment against an invoice (fee) with idempotency,
   * pessimistic row locking, and status/outstanding calculations.
   */
  public async recordPayment(actorId: string, role: string, feeId: string, dto: RecordPaymentDto) {
    const paymentAmount = roundMoney(dto.amount);
    if (paymentAmount <= 0) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, 'Payment amount must be greater than zero');
    }

    // Execute within a serializable/pessimistic-lock database transaction
    const result = await AppDataSource.transaction(async (manager) => {
      // 1. Fetch fee with write lock to prevent race conditions & overpayments
      const fee = await manager.findOne(Fee, {
        where: { id: feeId },
        lock: { mode: 'pessimistic_write' },
        relations: {
          resident: { user: true },
          hostel: { owner: true },
        },
      });

      if (!fee) {
        throw createHttpError(STATUS_CODE.NOT_FOUND, 'Invoice / Fee bill not found');
      }

      // 2. Authorization check
      const normalizedRole = role.toLowerCase();
      if (normalizedRole === IROLES.RESIDENT.toLowerCase()) {
        const residentRepo = manager.getRepository(Resident);
        const resident = await residentRepo.findOne({
          where: { userId: actorId, isActive: true },
        });
        if (!resident || resident.id !== fee.residentId) {
          throw createHttpError(STATUS_CODE.FORBIDDEN, 'You can only pay your own invoices');
        }
      } else if (normalizedRole === IROLES.OWNER.toLowerCase()) {
        if (fee.hostel.ownerId !== actorId) {
          throw createHttpError(
            STATUS_CODE.FORBIDDEN,
            'You are not authorized to record payments for this hostel',
          );
        }
      } else if (normalizedRole !== IROLES.ADMIN.toLowerCase()) {
        throw createHttpError(STATUS_CODE.FORBIDDEN, 'Unauthorized payment actor role');
      }

      // 3. Status checks
      if (fee.status === FeeStatus.CANCELLED) {
        throw createHttpError(
          STATUS_CODE.BAD_REQUEST,
          'Cannot record payment for a cancelled invoice',
        );
      }

      // 4. Idempotency checks
      if (dto.idempotencyKey?.trim()) {
        const existingKey = await manager.findOne(Payment, {
          where: { idempotencyKey: dto.idempotencyKey.trim() },
        });
        if (existingKey) {
          return { payment: existingKey, fee, isDuplicate: true };
        }
      }

      if (dto.transactionReference?.trim()) {
        const existingRef = await manager.findOne(Payment, {
          where: { invoiceId: fee.id, transactionReference: dto.transactionReference.trim() },
        });
        if (existingRef) {
          return { payment: existingRef, fee, isDuplicate: true };
        }
      }

      // 5. Calculate outstanding
      const outstanding = feeOutstandingAmount(fee);
      if (outstanding <= 0 && fee.status === FeeStatus.PAID) {
        throw createHttpError(STATUS_CODE.BAD_REQUEST, 'This invoice is already fully paid');
      }

      if (paymentAmount > outstanding) {
        throw createHttpError(
          STATUS_CODE.BAD_REQUEST,
          `Payment amount of NPR ${paymentAmount} exceeds remaining balance of NPR ${outstanding}`,
        );
      }

      // 6. Generate receipt number
      const receiptNumber = `REC-${fee.billingYear}${String(fee.billingMonth).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`;

      // 7. Insert payment
      const payment = manager.create(Payment, {
        invoiceId: fee.id,
        residentId: fee.residentId,
        hostelId: fee.hostelId,
        amount: paymentAmount,
        paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
        paymentStatus: PaymentStatus.SUCCESS,
        transactionReference: dto.transactionReference?.trim() || null,
        idempotencyKey: dto.idempotencyKey?.trim() || null,
        receiptNumber,
        receivedBy: actorId,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        remarks: dto.remarks?.trim() || null,
      });

      const savedPayment = await manager.save(payment);

      // 8. Update fee balance & status using centralized calculation
      const creditResult = applyPaymentToFeeAmounts(
        {
          totalPayable: Number(fee.totalPayable),
          paidAmount: Number(fee.paidAmount),
          discountAmount: Number(fee.discountAmount ?? 0),
          dueDate: fee.dueDate,
          status: fee.status,
        },
        paymentAmount,
      );

      fee.paidAmount = creditResult.paidAmount;
      fee.outstandingAmount = creditResult.outstandingAmount;
      fee.status = creditResult.status;
      if (creditResult.outstandingAmount === 0) {
        fee.dueAmount = 0;
      }

      const savedFee = await manager.save(fee);

      return { payment: savedPayment, fee: savedFee, isDuplicate: false };
    });

    // Post-transaction notifications and cache invalidations
    if (!result.isDuplicate) {
      await this.invalidatePaymentCaches(result.fee.hostelId, result.fee.residentId);

      // Push real-time event
      await eventDispatcher.dispatch({
        type: SocketEvent.PAYMENT_PROCESSED,
        payload: { payment: result.payment, fee: result.fee },
        userId: result.fee.resident?.userId,
        hostelId: result.fee.hostelId,
        metadata: { actorId, feeId, paymentId: result.payment.id },
      });

      // Resident notification
      if (result.fee.resident?.userId) {
        const isFull = result.fee.status === FeeStatus.PAID;
        const notifTitle = isFull ? 'Invoice Fully Paid! 🎉' : 'Partial Payment Received';
        const notifMessage = isFull
          ? `Your invoice for Month ${result.fee.billingMonth}/${result.fee.billingYear} has been fully settled (Paid: NPR ${paymentAmount}).`
          : `Payment of NPR ${paymentAmount} recorded. Remaining balance: NPR ${result.fee.outstandingAmount}.`;

        await notificationService.createNotification({
          userId: result.fee.resident.userId,
          hostelId: result.fee.hostelId,
          type: 'PAYMENT_CONFIRMED',
          entityType: 'payment',
          entityId: result.payment.id,
          title: notifTitle,
          message: notifMessage,
          targetUrl: '/resident/payments',
          metadata: {
            feeId,
            paymentId: result.payment.id,
            amount: paymentAmount,
            remainingBalance: result.fee.outstandingAmount,
          },
        });
      }
    }

    return result;
  }

  /**
   * Retrieves an invoice and all its payment transactions.
   */
  public async getInvoiceDetails(actorId: string, role: string, feeId: string) {
    const feeRepo = AppDataSource.getRepository(Fee);
    const fee = await feeRepo.findOne({
      where: { id: feeId },
      relations: {
        resident: { user: true },
        hostel: { owner: true },
        payments: { receivedByUser: true },
      },
    });

    if (!fee) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Invoice not found');
    }

    const normalizedRole = role.toLowerCase();
    if (normalizedRole === IROLES.RESIDENT.toLowerCase()) {
      if (fee.resident?.userId !== actorId) {
        throw createHttpError(STATUS_CODE.FORBIDDEN, 'Access denied to this invoice');
      }
    } else if (normalizedRole === IROLES.OWNER.toLowerCase()) {
      if (fee.hostel?.ownerId !== actorId) {
        throw createHttpError(STATUS_CODE.FORBIDDEN, 'Access denied to this hostel invoice');
      }
    }

    fee.outstandingAmount = feeOutstandingAmount(fee);
    fee.status = calculatePaymentStatus(fee);

    return fee;
  }

  /**
   * Retrieves payments list for a hostel (for hostel owners/admins).
   */
  public async getHostelPayments(
    actorId: string,
    role: string,
    hostelId: string,
    page: number = 1,
    limit: number = 20,
    filters: PaymentListFilters = {},
  ) {
    await this.authorizeHostel(actorId, role, hostelId);
    const [payments, total] = await this.paymentRepo.findByHostel(hostelId, page, limit, filters);
    return createPaginatedResponse(payments, total, { page, limit });
  }

  /**
   * Retrieves payments made by the logged-in resident.
   */
  public async getResidentPayments(userId: string, page: number = 1, limit: number = 20) {
    const residentRepo = AppDataSource.getRepository(Resident);
    const resident = await residentRepo.findOne({
      where: { userId, isActive: true },
    });

    if (!resident) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Resident profile not found');
    }

    const [payments, total] = await this.paymentRepo.findByResident(resident.id, page, limit);
    return createPaginatedResponse(payments, total, { page, limit });
  }

  /**
   * Generates formatted receipt data for download/printing.
   */
  public async getReceipt(actorId: string, role: string, paymentId: string) {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw createHttpError(STATUS_CODE.NOT_FOUND, 'Payment record not found');
    }

    const normalizedRole = role.toLowerCase();
    if (normalizedRole === IROLES.RESIDENT.toLowerCase()) {
      if (payment.resident?.userId !== actorId) {
        throw createHttpError(STATUS_CODE.FORBIDDEN, 'Access denied to this receipt');
      }
    } else if (normalizedRole === IROLES.OWNER.toLowerCase()) {
      if (payment.hostel?.ownerId !== actorId) {
        throw createHttpError(STATUS_CODE.FORBIDDEN, 'Access denied to this receipt');
      }
    }

    return {
      receiptNumber: payment.receiptNumber,
      paymentId: payment.id,
      paidAt: payment.paidAt,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      transactionReference: payment.transactionReference,
      remarks: payment.remarks,
      student: {
        name: `${payment.resident?.user?.firstName ?? ''} ${payment.resident?.user?.lastName ?? ''}`.trim(),
        email: payment.resident?.user?.email,
        phone: payment.resident?.user?.phone,
        roomNumber: payment.resident?.roomNumber,
        bedNumber: payment.resident?.bedNumber,
      },
      hostel: {
        name: payment.hostel?.name,
        address: payment.hostel?.address,
        city: payment.hostel?.city,
        phone: payment.hostel?.phone,
      },
      invoice: {
        invoiceNumber: payment.fee?.invoiceNumber,
        billingMonth: payment.fee?.billingMonth,
        billingYear: payment.fee?.billingYear,
        totalPayable: Number(payment.fee?.totalPayable),
        paidAmount: Number(payment.fee?.paidAmount),
        outstandingAmount: Number(payment.fee?.outstandingAmount),
        status: payment.fee?.status,
      },
      receiver: payment.receivedByUser
        ? `${payment.receivedByUser.firstName} ${payment.receivedByUser.lastName}`.trim()
        : 'System',
    };
  }

  /**
   * Syncs overdue status for all pending/partial fees past due date.
   */
  public async syncOverdueFees(hostelId?: string): Promise<number> {
    const feeRepo = AppDataSource.getRepository(Fee);
    const qb = feeRepo
      .createQueryBuilder('f')
      .where('f.status IN (:...statuses)', {
        statuses: [FeeStatus.PENDING, FeeStatus.PARTIALLY_PAID],
      })
      .andWhere('f.dueDate < CURRENT_DATE')
      .andWhere('GREATEST(0, f.totalPayable - f.discountAmount - f.paidAmount) > 0');

    if (hostelId) {
      qb.andWhere('f.hostelId = :hostelId', { hostelId });
    }

    const overdueFees = await qb.getMany();
    if (overdueFees.length === 0) return 0;

    for (const fee of overdueFees) {
      fee.status = FeeStatus.OVERDUE;
      fee.outstandingAmount = feeOutstandingAmount(fee);
    }

    await feeRepo.save(overdueFees);
    await cacheService.invalidatePattern('hostel:fees');
    await cacheService.invalidatePattern('resident:fees');

    return overdueFees.length;
  }

  private async invalidatePaymentCaches(hostelId: string, residentId: string) {
    await cacheService.invalidatePattern(`resident:fees:${residentId}`);
    await cacheService.invalidatePattern(`resident:fees`);
    await cacheService.invalidatePattern(`hostel:fees:${hostelId}`);
    await cacheService.invalidatePattern(`hostel:fees`);
    await cacheService.invalidatePattern(`owner:dashboard`);
    await cacheService.invalidatePattern(`analytics`);
  }
}

export const paymentService = new PaymentService();
