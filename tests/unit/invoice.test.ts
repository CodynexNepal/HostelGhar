import { describe, expect, it, vi } from 'vitest';
import {
  parseInvoiceBillingPeriod,
  parseInvoiceDueDate,
  resolveInvoiceSendMode,
} from '../../src/services/fee/invoice-parse.service';
import { renderManualInvoiceEmail } from '../../src/templates/invoice-email.template';
import { sendInvoiceEmail } from '../../src/services/fee/invoice-email.service';
import { eventDispatcher } from '../../src/utils/event-dispatcher.util';

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
    expect(resolveInvoiceSendMode({ status: 'SENT' } as never)).toBe('SEND_NOW');
    expect(resolveInvoiceSendMode({ status: 'sent' } as never)).toBe('SEND_NOW');
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
    expect(mail.html).toContain('PENDING (Unpaid)');
    expect(mail.html).toContain('/resident/payments');
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

  it('delivers invoice email to resident user email', async () => {
    const queueSpy = vi
      .spyOn(eventDispatcher, 'queueEmail')
      .mockResolvedValue({ id: 'job-1' } as any);

    const mockFee: any = { id: 'fee-uuid-1234' };
    const mockResident: any = {
      userId: 'user-1',
      user: { firstName: 'Ram', lastName: 'Thapa', email: 'ram.thapa@example.com' },
      roomNumber: '101',
    };
    const mockHostel: any = {
      name: 'Kathmandu Boys Hostel',
      owner: { firstName: 'Suresh', lastName: 'Shrestha' },
    };

    const recipient = await sendInvoiceEmail({
      fee: mockFee,
      resident: mockResident,
      hostel: mockHostel,
      billingMonth: 10,
      billingYear: 2026,
      amount: 11000,
      outstandingDue: 0,
      totalPayable: 11000,
      dueDate: '2026-10-31',
      isDraftPreview: false,
      actorId: 'owner-1',
    });

    expect(recipient).toBe('ram.thapa@example.com');
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ to: 'ram.thapa@example.com' }),
    );
  });

  it('falls back to residentEmail when resident.user has no email on file', async () => {
    const queueSpy = vi
      .spyOn(eventDispatcher, 'queueEmail')
      .mockResolvedValue({ id: 'job-2' } as any);

    const mockFee: any = { id: 'fee-uuid-5678' };
    const mockResident: any = {
      userId: 'user-2',
      user: null,
      roomNumber: '102',
    };
    const mockHostel: any = {
      name: 'Lalitpur Girls Hostel',
      owner: { firstName: 'Gita', lastName: 'Adhikari' },
    };

    const recipient = await sendInvoiceEmail({
      fee: mockFee,
      resident: mockResident,
      hostel: mockHostel,
      billingMonth: 10,
      billingYear: 2026,
      amount: 10500,
      outstandingDue: 500,
      totalPayable: 11000,
      dueDate: '2026-10-31',
      isDraftPreview: false,
      actorId: 'owner-2',
      residentEmail: 'fallback.student@gmail.com',
    });

    expect(recipient).toBe('fallback.student@gmail.com');
    expect(queueSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ to: 'fallback.student@gmail.com' }),
    );
  });

  it('returns null safely when no recipient email is available', async () => {
    const queueSpy = vi
      .spyOn(eventDispatcher, 'queueEmail')
      .mockResolvedValue({ id: 'job-3' } as any);

    const mockFee: any = { id: 'fee-uuid-9999' };
    const mockResident: any = {
      userId: 'user-3',
      user: { firstName: 'No', lastName: 'Email', email: '' },
      roomNumber: '103',
    };
    const mockHostel: any = {
      name: 'Patan Hostel',
      owner: { firstName: 'Owner', lastName: 'Name' },
    };

    const recipient = await sendInvoiceEmail({
      fee: mockFee,
      resident: mockResident,
      hostel: mockHostel,
      billingMonth: 10,
      billingYear: 2026,
      amount: 9000,
      outstandingDue: 0,
      totalPayable: 9000,
      dueDate: '2026-10-31',
      isDraftPreview: false,
      actorId: 'owner-3',
    });

    expect(recipient).toBeNull();
    expect(queueSpy).not.toHaveBeenCalled();
  });
});
