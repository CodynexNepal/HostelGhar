"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee-credit.util.ts
// PURPOSE: Pure (DB-free) credit math shared by every path that marks a monthly
//          fee bill paid: owner proof approval, manual owner payment, etc.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFeeUnsettled = exports.feeOutstandingAmount = exports.applyPaymentToFeeAmounts = exports.calculatePaymentStatus = exports.getNepalTodayString = exports.getNepalNow = exports.roundMoney = void 0;
const fee_enum_1 = require("../enum/fee.enum");
/** Round monetary values to 2 decimal places avoiding IEEE floating-point inaccuracy. */
const roundMoney = (value) => {
    const numVal = Number(value);
    if (!Number.isFinite(numVal))
        return 0;
    return Math.round((numVal + Number.EPSILON) * 100) / 100;
};
exports.roundMoney = roundMoney;
/** Get current Date in Nepal Timezone (UTC+5:45). */
const getNepalNow = (date = new Date()) => {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    return new Date(utc + 5.75 * 3600000);
};
exports.getNepalNow = getNepalNow;
/** Get YYYY-MM-DD date string in Nepal Timezone. */
const getNepalTodayString = (date = new Date()) => {
    const n = (0, exports.getNepalNow)(date);
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, '0');
    const d = String(n.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};
exports.getNepalTodayString = getNepalTodayString;
/**
 * Calculates current payment status based on due date, paid amount and total payable.
 * Rules:
 *  - CANCELLED stays CANCELLED
 *  - Outstanding balance <= 0 (and totalPayable > 0) -> PAID
 *  - Outstanding balance > 0 and dueDate < Nepal today -> OVERDUE (even if partially paid)
 *  - Outstanding balance > 0, dueDate not passed, paidAmount > 0 -> PARTIALLY_PAID
 *  - Outstanding balance > 0, dueDate not passed, paidAmount == 0 -> PENDING
 */
const calculatePaymentStatus = (fee, now = new Date()) => {
    if (fee.status === fee_enum_1.FeeStatus.CANCELLED) {
        return fee_enum_1.FeeStatus.CANCELLED;
    }
    const discount = (0, exports.roundMoney)(fee.discountAmount ?? 0);
    const total = (0, exports.roundMoney)(Math.max((0, exports.roundMoney)(fee.totalPayable) - discount, 0));
    const paid = (0, exports.roundMoney)(Math.max((0, exports.roundMoney)(fee.paidAmount), 0));
    const outstanding = (0, exports.roundMoney)(Math.max(total - paid, 0));
    if (outstanding <= 0 && total > 0) {
        return fee_enum_1.FeeStatus.PAID;
    }
    if (fee.dueDate) {
        const dueStr = typeof fee.dueDate === 'string'
            ? fee.dueDate.slice(0, 10)
            : fee.dueDate.toISOString().slice(0, 10);
        const todayStr = (0, exports.getNepalTodayString)(now);
        if (dueStr < todayStr && outstanding > 0) {
            return fee_enum_1.FeeStatus.OVERDUE;
        }
    }
    if (paid > 0) {
        return fee_enum_1.FeeStatus.PARTIALLY_PAID;
    }
    return fee_enum_1.FeeStatus.PENDING;
};
exports.calculatePaymentStatus = calculatePaymentStatus;
/**
 * Applies a payment of `paymentAmount` to a fee bill.
 *
 * Rules:
 *  - Credit is clamped to the outstanding balance (never overpays unless explicitly specified).
 *  - A missing/zero/non-finite payment means "owner approved the proof as
 *    settlement of this bill" -> credit the FULL outstanding.
 *  - Fully settled => PAID, partially settled => PARTIALLY_PAID (or OVERDUE if past due date).
 */
const applyPaymentToFeeAmounts = (fee, paymentAmount, now = new Date()) => {
    const discount = (0, exports.roundMoney)(fee.discountAmount ?? 0);
    const total = (0, exports.roundMoney)(Math.max((0, exports.roundMoney)(fee.totalPayable) - discount, 0));
    const alreadyPaid = (0, exports.roundMoney)(Math.min(Math.max((0, exports.roundMoney)(fee.paidAmount), 0), total));
    const outstanding = (0, exports.roundMoney)(Math.max(total - alreadyPaid, 0));
    const finalize = (paidAmount, credited) => {
        const nextOutstanding = (0, exports.roundMoney)(Math.max(total - paidAmount, 0));
        const status = (0, exports.calculatePaymentStatus)({
            totalPayable: total,
            paidAmount,
            dueDate: fee.dueDate,
            status: fee.status === fee_enum_1.FeeStatus.CANCELLED ? fee_enum_1.FeeStatus.CANCELLED : undefined,
        }, now);
        return {
            totalPayable: total,
            paidAmount,
            outstandingAmount: nextOutstanding,
            status,
            credited,
            changed: paidAmount !== (0, exports.roundMoney)(fee.paidAmount) || status !== fee.status,
        };
    };
    // If already CANCELLED, do not modify
    if (fee.status === fee_enum_1.FeeStatus.CANCELLED) {
        return {
            totalPayable: total,
            paidAmount: alreadyPaid,
            outstandingAmount: outstanding,
            status: fee_enum_1.FeeStatus.CANCELLED,
            credited: 0,
            changed: false,
        };
    }
    // Already marked PAID: repair short paidAmount if any, otherwise return
    if (fee.status === fee_enum_1.FeeStatus.PAID) {
        return outstanding > 0
            ? {
                totalPayable: total,
                paidAmount: total,
                outstandingAmount: 0,
                status: fee_enum_1.FeeStatus.PAID,
                credited: outstanding,
                changed: true,
            }
            : {
                totalPayable: total,
                paidAmount: alreadyPaid,
                outstandingAmount: 0,
                status: fee_enum_1.FeeStatus.PAID,
                credited: 0,
                changed: false,
            };
    }
    // Nothing outstanding
    if (outstanding <= 0)
        return finalize(total, 0);
    const requested = paymentAmount !== undefined ? (0, exports.roundMoney)(paymentAmount) : outstanding;
    const credit = requested > 0 ? Math.min(requested, outstanding) : outstanding;
    const newPaidAmount = (0, exports.roundMoney)(alreadyPaid + credit);
    return finalize(newPaidAmount, credit);
};
exports.applyPaymentToFeeAmounts = applyPaymentToFeeAmounts;
/** Outstanding balance still owed on a bill (never negative). */
const feeOutstandingAmount = (fee) => {
    const discount = (0, exports.roundMoney)(fee.discountAmount ?? 0);
    const total = (0, exports.roundMoney)(Math.max((0, exports.roundMoney)(fee.totalPayable) - discount, 0));
    const paid = (0, exports.roundMoney)(fee.paidAmount);
    return (0, exports.roundMoney)(Math.max(total - paid, 0));
};
exports.feeOutstandingAmount = feeOutstandingAmount;
/** True when a bill still contributes to the resident's current dues. */
const isFeeUnsettled = (fee) => fee.status !== fee_enum_1.FeeStatus.PAID &&
    fee.status !== fee_enum_1.FeeStatus.CANCELLED &&
    (0, exports.feeOutstandingAmount)(fee) > 0;
exports.isFeeUnsettled = isFeeUnsettled;
