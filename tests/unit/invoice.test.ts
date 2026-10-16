import { describe, expect, it } from 'vitest';
import {
  parseInvoiceBillingPeriod,
  parseInvoiceDueDate,
  resolveInvoiceSendMode,
} from '../../src/services/fee/invoice-parse.service';
import { renderManualInvoiceEmail } from '../../src/templates/invoice-email.template';

describe('manual invoice parsing', () => {
  it('parses flexible billing month shapes', () => {
    expect(parseInvoiceBillingPeriod(9, 2026)).toEqual({ month: 9, year: 2026 });
    expect(parseInvoiceBillingPeriod('2026-09')).toEqual({ month: 9, year: 2026 });
    expect(parseInvoiceBillingPeriod('09/2026')).toEqual({ month: 9, year: 2026 });
    expect(parseInvoiceBillingPeriod('September 2026')).toEqual({ month: 9, year: 2026 });
    expect(parseInvoiceBillingPeriod('Sept 2026')).toEqual({ month: 9, year: 2026 });
  });

  it('rejects invalid billing months', () => {
    expect(() => parseInvoiceBillingPeriod(13)).toThrow();
    expect(() => parseInvoiceBillingPeriod('NotAMonth 2026')).toThrow();
  });

  it('parses ISO and mm/dd/yyyy due dates', () => {
    expect(parseInvoiceDueDate('2026-10-31')).toBe('2026-10-31');
    expect(parseInvoiceDueDate('10/31/2026')).toBe('2026-10-31');
    expect(() => parseInvoiceDueDate('31-10-2026')).toThrow();
  });

  it('resolves Draft vs Send now from status/sendMode/sendNow aliases', () => {
    expect(resolveInvoiceSendMode({ status: 'Draft' } as never)).toBe('DRAFT');
    expect(resolveInvoiceSendMode({} as never)).toBe('DRAFT');
    expect(resolveInvoiceSendMode({ sendMode: 'Send now' } as never)).toBe('SEND_NOW');
    expect(resolveInvoiceSendMode({ sendNow: true } as never)).toBe('SEND_NOW');
    expect(resolveInvoiceSendMode({ status: 'PENDING' } as never)).toBe('SEND_NOW');
  });
});

describe('manual invoice email', () => {
  it('renders HostelGhar final invoice with hostel identity + totals', () => {
    const mail = renderManualInvoiceEmail({
      studentName: 'Sita Karki',
      hostelName: 'Sunrise Hostel',
      ownerName: 'Hari Owner',
      billingLabel: 'Sep 2026',
      amount: 8500,
      outstandingDue: 500,
      totalPayable: 9000,
      dueDateAd: '2026-10-31',
      billNo: 'ABC12345',
      isDraftPreview: false,
    });
    expect(mail.subject).toContain('Sep 2026');
    expect(mail.subject).toContain('Sunrise Hostel');
    expect(mail.body).toContain('Hari Owner');
    expect(mail.html).toContain('FINAL INVOICE');
    expect(mail.html).toContain('9,000.00');
  });

  it('renders a draft preview with no-payment-due copy', () => {
    const mail = renderManualInvoiceEmail({
      studentName: 'Sita Karki',
      hostelName: 'Sunrise Hostel',
      ownerName: 'Hari Owner',
      billingLabel: 'Sep 2026',
      amount: 8500,
      outstandingDue: 0,
      totalPayable: 8500,
      dueDateAd: '2026-10-31',
      isDraftPreview: true,
    });
    expect(mail.subject).toContain('Preview');
    expect(mail.html).toContain('DRAFT PREVIEW');
    expect(mail.body).toContain('no payment is due yet');
  });
});
