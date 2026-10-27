"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee-credit.util.ts
// PURPOSE: Pure (DB-free) credit math shared by every path that marks a monthly
//          fee bill paid: owner proof approval, manual owner payment, etc.
//
//          Why a separate util: the "proof approved but ledger still says
//          PAID with Paid: Rs. 0 / dues still charged" bug lives entirely in
//          this arithmetic, so it must be testable without Postgres/Redis.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFeeUnsettled = exports.feeOutstandingAmount = exports.applyPaymentToFeeAmounts = void 0;
const fee_enum_1 = require("../enum/fee.enum");
const num = (value) => {
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
const applyPaymentToFeeAmounts = (fee, paymentAmount) => {
    const total = Math.max(num(fee.totalPayable), 0);
    const alreadyPaid = Math.min(Math.max(num(fee.paidAmount), 0), total);
    const outstanding = Math.max(total - alreadyPaid, 0);
    const finalize = (paidAmount, credited) => {
        const status = total > 0 && paidAmount >= total ? fee_enum_1.FeeStatus.PAID : fee_enum_1.FeeStatus.PARTIALLY_PAID;
        return {
            totalPayable: total,
            paidAmount,
            status,
            credited,
            changed: paidAmount !== num(fee.paidAmount) || status !== fee.status,
        };
    };
    // Already marked PAID: never take money back, but repair a short paidAmount.
    if (fee.status === fee_enum_1.FeeStatus.PAID) {
        return outstanding > 0
            ? {
                totalPayable: total,
                paidAmount: total,
                status: fee_enum_1.FeeStatus.PAID,
                credited: outstanding,
                changed: true,
            }
            : {
                totalPayable: total,
                paidAmount: alreadyPaid,
                status: fee_enum_1.FeeStatus.PAID,
                credited: 0,
                changed: false,
            };
    }
    // Nothing outstanding (e.g. previous partial payments settled it).
    if (outstanding <= 0)
        return finalize(total, 0);
    const requested = num(paymentAmount);
    const credit = requested > 0 ? Math.min(requested, outstanding) : outstanding;
    return finalize(alreadyPaid + credit, credit);
};
exports.applyPaymentToFeeAmounts = applyPaymentToFeeAmounts;
/** Outstanding balance still owed on a bill (never negative). */
const feeOutstandingAmount = (fee) => Math.max(num(fee.totalPayable) - num(fee.paidAmount), 0);
exports.feeOutstandingAmount = feeOutstandingAmount;
/** True when a bill still contributes to the resident's current dues. */
const isFeeUnsettled = (fee) => fee.status !== fee_enum_1.FeeStatus.PAID || (0, exports.feeOutstandingAmount)(fee) > 0;
exports.isFeeUnsettled = isFeeUnsettled;
