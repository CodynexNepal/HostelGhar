// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee-credit.util.ts
// PURPOSE: Pure (DB-free) credit math shared by every path that marks a monthly
//          fee bill paid: owner proof approval, manual owner payment, etc.
//
//          Why a separate util: the "proof approved but ledger still says
//          PAID with Paid: Rs. 0 / dues still charged" bug lives entirely in
//          this arithmetic, so it must be testable without Postgres/Redis.
// ──────────────────────────────────────────────────────────────────────────────

import { FeeStatus } from '../enum/fee.enum';

export interface FeeAmounts {
  totalPayable: number;
  paidAmount: number;
  status: FeeStatus;
}

export interface FeeCreditResult extends FeeAmounts {
  /** How much of THIS payment was actually applied (clamped to outstanding). */
  credited: number;
  /** True when the row must be written back. */
  changed: boolean;
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Applies a payment of `paymentAmount` to a fee bill.
 *
 * Rules:
 *  - Credit is clamped to the outstanding balance (never overpays).
 *  - A missing/zero/non-finite payment means "owner approved the proof as
 *    settlement of this bill" → credit the FULL outstanding, so status flips
 *    to PAID and the resident's current dues become 0 instead of staying 0-paid.
 *  - status PAID never regresses, but a mislabelled row (PAID yet paidAmount
 *    short of totalPayable — exactly the reported symptom) is REPAIRED to
 *    paidAmount = totalPayable on the next sync/approve click.
 *  - Fully settled ⇒ PAID, partially settled ⇒ PARTIALLY_PAID.
 */
export const applyPaymentToFeeAmounts = (
  fee: FeeAmounts,
  paymentAmount: number,
): FeeCreditResult => {
  const total = Math.max(num(fee.totalPayable), 0);
  const alreadyPaid = Math.min(Math.max(num(fee.paidAmount), 0), total);
  const outstanding = Math.max(total - alreadyPaid, 0);

  const finalize = (paidAmount: number, credited: number): FeeCreditResult => {
    const status =
      total > 0 && paidAmount >= total ? FeeStatus.PAID : FeeStatus.PARTIALLY_PAID;
    return {
      totalPayable: total,
      paidAmount,
      status,
      credited,
      changed: paidAmount !== num(fee.paidAmount) || status !== fee.status,
    };
  };

  // Already marked PAID: never take money back, but repair a short paidAmount.
  if (fee.status === FeeStatus.PAID) {
    return outstanding > 0
      ? {
          totalPayable: total,
          paidAmount: total,
          status: FeeStatus.PAID,
          credited: outstanding,
          changed: true,
        }
      : {
          totalPayable: total,
          paidAmount: alreadyPaid,
          status: FeeStatus.PAID,
          credited: 0,
          changed: false,
        };
  }

  // Nothing outstanding (e.g. previous partial payments settled it).
  if (outstanding <= 0) return finalize(total, 0);

  const requested = num(paymentAmount);
  const credit = requested > 0 ? Math.min(requested, outstanding) : outstanding;
  return finalize(alreadyPaid + credit, credit);
};

/** Outstanding balance still owed on a bill (never negative). */
export const feeOutstandingAmount = (fee: Pick<FeeAmounts, 'totalPayable' | 'paidAmount'>): number =>
  Math.max(num(fee.totalPayable) - num(fee.paidAmount), 0);

/** True when a bill still contributes to the resident's current dues. */
export const isFeeUnsettled = (fee: FeeAmounts): boolean =>
  fee.status !== FeeStatus.PAID || feeOutstandingAmount(fee) > 0;
