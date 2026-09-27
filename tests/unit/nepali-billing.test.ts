import { describe, expect, it } from 'vitest';
import {
  formatNepaliDate,
  formatNepaliMonthYear,
  isFirstDayOfNepaliMonth,
  toNepaliDate,
} from '../../src/utils/nepali-date.util';
import { renderMonthlyFeeBillEmail } from '../../src/templates/email.template';

describe('nepali billing date', () => {
  it('converts a known AD date to BS (2026-09-25 ~ Ashwin 2083)', () => {
    const bs = toNepaliDate(new Date(Date.UTC(2026, 8, 25)));
    expect(bs.year).toBe(2083);
    expect(bs.month).toBe(6);
    expect(formatNepaliMonthYear(bs)).toBe('Ashwin 2083');
  });

  it('detects Nepali 1st dynamically (day 1 => true, day 2 => false)', () => {
    // Find a real gatey near Aug 2026 instead of hardcoding a possibly-off date.
    let first: Date | null = null;
    for (let day = 14; day <= 20; day += 1) {
      const candidate = new Date(Date.UTC(2026, 7, day));
      if (isFirstDayOfNepaliMonth(candidate)) {
        first = candidate;
        break;
      }
    }
    expect(first).not.toBeNull();
    expect(isFirstDayOfNepaliMonth(new Date(first!.getTime() + 24 * 60 * 60 * 1000))).toBe(false);
  });

  it('renders a fee bill with hostel + owner identity', () => {
    const bill = renderMonthlyFeeBillEmail({
      studentName: 'Ram Sharma',
      hostelName: 'Sunrise Hostel',
      ownerName: 'Hari Owner',
      nepaliMonthLabel: 'Ashwin 2083',
      nepaliDateLabel: formatNepaliDate({ year: 2083, month: 6, day: 1 }),
      baseFee: 10500,
      outstandingDue: 500,
      totalPayable: 11000,
      dueDateAd: '2026-09-07',
      dueDateBs: '7 Ashwin 2083 BS',
      billNo: 'ABC12345',
    });
    expect(bill.subject).toContain('Ashwin 2083');
    expect(bill.subject).toContain('Sunrise Hostel');
    expect(bill.body).toContain('Hari Owner');
    expect(bill.html).toContain('Sunrise Hostel');
    expect(bill.html).toContain('11,000.00');
  });
});
