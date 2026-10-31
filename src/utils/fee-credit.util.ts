// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee-credit.util.ts
// PURPOSE: Pure (DB-free) credit math shared by every path that marks a monthly
//          fee bill paid: owner proof approval, manual owner payment, etc.
// ──────────────────────────────────────────────────────────────────────────────

import { FeeStatus } from '../enum/fee.enum';

export interface FeeAmounts {
  totalPayable: number;
  paidAmount: number;
  status: FeeStatus;
  dueDate?: string | Date | null | undefined;
  discountAmount?: number | undefined;
}

export interface FeeCreditResult {
  totalPayable: number;
  paidAmount: number;
  outstandingAmount: number;
  status: FeeStatus;
  /** How much of THIS payment was actually applied (clamped to outstanding). */
  credited: number;
  /** True when the row must be written back. */
  changed: boolean;
}

/** Round monetary values to 2 decimal places avoiding IEEE floating-point inaccuracy. */
export const roundMoney = (value: unknown): number => {
  const numVal = Number(value);
  if (!Number.isFinite(numVal)) return 0;
  return Math.round((numVal + Number.EPSILON) * 100) / 100;
};

/** Get current Date in Nepal Timezone (UTC+5:45). */
export const getNepalNow = (date: Date = new Date()): Date => {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 5.75 * 3600000);
};

/** Get YYYY-MM-DD date string in Nepal Timezone. */
export const getNepalTodayString = (date: Date = new Date()): string => {
  const n = getNepalNow(date);
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Calculates current payment status based on due date, paid amount and total payable.
 * Rules:
 *  - CANCELLED stays CANCELLED
 *  - Outstanding balance <= 0 (and totalPayable > 0) -> PAID
 *  - Outstanding balance > 0 and dueDate < Nepal today -> OVERDUE (even if partially paid)
 *  - Outstanding balance > 0, dueDate not passed, paidAmount > 0 -> PARTIALLY_PAID
 *  - Outstanding balance > 0, dueDate not passed, paidAmount == 0 -> PENDING
 */
export const calculatePaymentStatus = (
  fee: {
    totalPayable: number;
    paidAmount: number;
    dueDate?: string | Date | null | undefined;
    status?: FeeStatus | undefined;
    discountAmount?: number | undefined;
  },
  now: Date = new Date(),
): FeeStatus => {
  if (fee.status === FeeStatus.CANCELLED) {
    return FeeStatus.CANCELLED;
  }

  const discount = roundMoney(fee.discountAmount ?? 0);
  const total = roundMoney(Math.max(roundMoney(fee.totalPayable) - discount, 0));
  const paid = roundMoney(Math.max(roundMoney(fee.paidAmount), 0));
  const outstanding = roundMoney(Math.max(total - paid, 0));

  if (outstanding <= 0 && total > 0) {
    return FeeStatus.PAID;
  }

  if (fee.dueDate) {
    const dueStr =
      typeof fee.dueDate === 'string'
        ? fee.dueDate.slice(0, 10)
        : fee.dueDate.toISOString().slice(0, 10);
    const todayStr = getNepalTodayString(now);

    if (dueStr < todayStr && outstanding > 0) {
      return FeeStatus.OVERDUE;
    }
  }

  if (paid > 0) {
    return FeeStatus.PARTIALLY_PAID;
  }

  return FeeStatus.PENDING;
};

/**
 * Applies a payment of `paymentAmount` to a fee bill.
 *
 * Rules:
 *  - Credit is clamped to the outstanding balance (never overpays unless explicitly specified).
 *  - A missing/zero/non-finite payment means "owner approved the proof as
 *    settlement of this bill" -> credit the FULL outstanding.
 *  - Fully settled => PAID, partially settled => PARTIALLY_PAID (or OVERDUE if past due date).
 */
export const applyPaymentToFeeAmounts = (
  fee: FeeAmounts,
  paymentAmount?: number,
  now: Date = new Date(),
): FeeCreditResult => {
  const discount = roundMoney(fee.discountAmount ?? 0);
  const total = roundMoney(Math.max(roundMoney(fee.totalPayable) - discount, 0));
  const alreadyPaid = roundMoney(Math.min(Math.max(roundMoney(fee.paidAmount), 0), total));
  const outstanding = roundMoney(Math.max(total - alreadyPaid, 0));

  const finalize = (paidAmount: number, credited: number): FeeCreditResult => {
    const nextOutstanding = roundMoney(Math.max(total - paidAmount, 0));
    const status = calculatePaymentStatus(
      {
        totalPayable: total,
        paidAmount,
        dueDate: fee.dueDate,
        status: fee.status === FeeStatus.CANCELLED ? FeeStatus.CANCELLED : undefined,
      },
      now,
    );

    return {
      totalPayable: total,
      paidAmount,
      outstandingAmount: nextOutstanding,
      status,
      credited,
      changed: paidAmount !== roundMoney(fee.paidAmount) || status !== fee.status,
    };
  };

  // If already CANCELLED, do not modify
  if (fee.status === FeeStatus.CANCELLED) {
    return {
      totalPayable: total,
      paidAmount: alreadyPaid,
      outstandingAmount: outstanding,
      status: FeeStatus.CANCELLED,
      credited: 0,
      changed: false,
    };
  }

  // Already marked PAID: repair short paidAmount if any, otherwise return
  if (fee.status === FeeStatus.PAID) {
    return outstanding > 0
      ? {
          totalPayable: total,
          paidAmount: total,
          outstandingAmount: 0,
          status: FeeStatus.PAID,
          credited: outstanding,
          changed: true,
        }
      : {
          totalPayable: total,
          paidAmount: alreadyPaid,
          outstandingAmount: 0,
          status: FeeStatus.PAID,
          credited: 0,
          changed: false,
        };
  }

  // Nothing outstanding
  if (outstanding <= 0) return finalize(total, 0);

  const requested = paymentAmount !== undefined ? roundMoney(paymentAmount) : outstanding;
  const credit = requested > 0 ? Math.min(requested, outstanding) : outstanding;
  const newPaidAmount = roundMoney(alreadyPaid + credit);

  return finalize(newPaidAmount, credit);
};

/** Outstanding balance still owed on a bill (never negative). */
export const feeOutstandingAmount = (
  fee: Pick<FeeAmounts, 'totalPayable' | 'paidAmount'> & { discountAmount?: number | undefined },
): number => {
  const discount = roundMoney(fee.discountAmount ?? 0);
  const total = roundMoney(Math.max(roundMoney(fee.totalPayable) - discount, 0));
  const paid = roundMoney(fee.paidAmount);
  return roundMoney(Math.max(total - paid, 0));
};

/** True when a bill still contributes to the resident's current dues. */
export const isFeeUnsettled = (fee: FeeAmounts): boolean =>
  fee.status !== FeeStatus.PAID &&
  fee.status !== FeeStatus.CANCELLED &&
  feeOutstandingAmount(fee) > 0;
