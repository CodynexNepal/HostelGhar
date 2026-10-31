// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-lifecycle.test.ts
// PURPOSE: Verifies all partial payment, overdue calculation, and status rules
//          specified in the Hostel Ghar requirements.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { FeeStatus } from '../../src/enum/fee.enum';
import {
  applyPaymentToFeeAmounts,
  calculatePaymentStatus,
  feeOutstandingAmount,
  getNepalTodayString,
  roundMoney,
} from '../../src/utils/fee-credit.util';

describe('Payment & Overdue Lifecycle Test Suite', () => {
  const futureDueDate = '2099-12-31';
  const pastDueDate = '2020-01-01';

  it('Test Case 1: Initial Partial Payment (10,000 fee, 4,000 paid) -> PARTIALLY_PAID, 6,000 remaining', () => {
    const fee = {
      totalPayable: 10000,
      paidAmount: 0,
      status: FeeStatus.PENDING,
      dueDate: futureDueDate,
    };

    const result = applyPaymentToFeeAmounts(fee, 4000);

    expect(result.paidAmount).toBe(4000);
    expect(result.outstandingAmount).toBe(6000);
    expect(result.status).toBe(FeeStatus.PARTIALLY_PAID);
    expect(result.credited).toBe(4000);
  });

  it('Test Case 2: Additional Partial Payment (another 2,000 paid) -> PARTIALLY_PAID, 4,000 remaining', () => {
    const fee = {
      totalPayable: 10000,
      paidAmount: 4000,
      status: FeeStatus.PARTIALLY_PAID,
      dueDate: futureDueDate,
    };

    const result = applyPaymentToFeeAmounts(fee, 2000);

    expect(result.paidAmount).toBe(6000);
    expect(result.outstandingAmount).toBe(4000);
    expect(result.status).toBe(FeeStatus.PARTIALLY_PAID);
    expect(result.credited).toBe(2000);
  });

  it('Test Case 3: Due date passes with NPR 4,000 outstanding -> OVERDUE', () => {
    const status = calculatePaymentStatus({
      totalPayable: 10000,
      paidAmount: 6000,
      dueDate: pastDueDate,
    });

    expect(status).toBe(FeeStatus.OVERDUE);

    const outstanding = feeOutstandingAmount({
      totalPayable: 10000,
      paidAmount: 6000,
    });
    expect(outstanding).toBe(4000);
  });

  it('Test Case 4: Student pays the remaining NPR 4,000 after deadline -> PAID, Outstanding 0', () => {
    const fee = {
      totalPayable: 10000,
      paidAmount: 6000,
      status: FeeStatus.OVERDUE,
      dueDate: pastDueDate,
    };

    const result = applyPaymentToFeeAmounts(fee, 4000);

    expect(result.paidAmount).toBe(10000);
    expect(result.outstandingAmount).toBe(0);
    expect(result.status).toBe(FeeStatus.PAID);
    expect(result.credited).toBe(4000);
  });

  it('Never marks student as PAID unless full payable amount has been received', () => {
    const fee = {
      totalPayable: 10000,
      paidAmount: 9999.99,
      status: FeeStatus.PENDING,
      dueDate: futureDueDate,
    };

    const status = calculatePaymentStatus(fee);
    expect(status).toBe(FeeStatus.PARTIALLY_PAID);
  });

  it('Handles discounts accurately in outstanding calculation', () => {
    const fee = {
      totalPayable: 10000,
      discountAmount: 1000,
      paidAmount: 4000,
      dueDate: futureDueDate,
    };

    const outstanding = feeOutstandingAmount(fee);
    expect(outstanding).toBe(5000); // 10000 - 1000 - 4000
  });

  it('Floating-point monetary calculation precision test', () => {
    // 0.1 + 0.2 in JS is 0.30000000000000004
    const a = 0.1;
    const b = 0.2;
    expect(roundMoney(a + b)).toBe(0.3);

    const fee = {
      totalPayable: 10500.33,
      paidAmount: 3500.11,
      status: FeeStatus.PENDING,
      dueDate: futureDueDate,
    };

    const result = applyPaymentToFeeAmounts(fee, 7000.22);
    expect(result.paidAmount).toBe(10500.33);
    expect(result.outstandingAmount).toBe(0);
    expect(result.status).toBe(FeeStatus.PAID);
  });

  it('Prevents overpayments and clamps credit to outstanding balance', () => {
    const fee = {
      totalPayable: 5000,
      paidAmount: 4000,
      status: FeeStatus.PARTIALLY_PAID,
      dueDate: futureDueDate,
    };

    const result = applyPaymentToFeeAmounts(fee, 2500); // requested 2500 when only 1000 due
    expect(result.credited).toBe(1000);
    expect(result.paidAmount).toBe(5000);
    expect(result.outstandingAmount).toBe(0);
    expect(result.status).toBe(FeeStatus.PAID);
  });

  it('Handles Nepal timezone dates correctly', () => {
    const todayStr = getNepalTodayString();
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
