// ─────────────────────────────────────────────────────────────
// FILE: invoice-email.template.ts (part 1/2)
// PURPOSE: HostelGhar manual-invoice email types + text body.
// ─────────────────────────────────────────────────────────────

import { EmailTemplate } from './email.template';

export interface ManualInvoiceEmailInput {
  studentName: string;
  hostelName: string;
  ownerName: string;
  hostelAddress?: string | null;
  hostelPhone?: string | null;
  hostelEmail?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
  billingLabel: string;
  amount: number;
  outstandingDue: number;
  totalPayable: number;
  dueDateAd: string;
  dueDateBs?: string;
  billNo?: string;
  isDraftPreview: boolean;
}

export const nprInvoice = (value: number): string =>
  `NPR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const escapeInvoiceHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const invoiceIntroText = (
  isDraftPreview: boolean,
  billingLabel: string,
  hostelName: string,
): string =>
  isDraftPreview
    ? `This is a preview of your hostel invoice for ${billingLabel} prepared by ${hostelName}. It is marked as DRAFT and no payment is due yet.`
    : `Your hostel invoice for ${billingLabel} has been issued by ${hostelName}. Please find the billing details below.`;

export const renderManualInvoiceText = (input: ManualInvoiceEmailInput): EmailTemplate => {
  const subject = input.isDraftPreview
    ? `HostelGhar Invoice Preview — ${input.billingLabel} | ${input.hostelName}`
    : `HostelGhar Invoice — ${input.billingLabel} | ${input.hostelName}`;
  const body =
    `Dear ${input.studentName},\n\n` +
    `${invoiceIntroText(input.isDraftPreview, input.billingLabel, input.hostelName)}\n\n` +
    `Hostel: ${input.hostelName}\n` +
    `Hostel Owner: ${input.ownerName}\n` +
    (input.roomNumber ? `Room: ${input.roomNumber}\n` : '') +
    (input.bedNumber ? `Bed: ${input.bedNumber}\n` : '') +
    `\nBilling Period: ${input.billingLabel}\n` +
    `Invoice Amount: ${nprInvoice(input.amount)}\n` +
    `Previous Outstanding Due: ${nprInvoice(input.outstandingDue)}\n` +
    `Total Amount Payable: ${nprInvoice(input.totalPayable)}\n` +
    `Due Date (AD): ${input.dueDateAd}\n` +
    (input.dueDateBs ? `Due Date (BS): ${input.dueDateBs}\n` : '') +
    (input.billNo ? `Invoice No: ${input.billNo}\n` : '') +
    (input.isDraftPreview
      ? `\nThis is a DRAFT preview — please wait for the final invoice before paying.\n\n`
      : `\nPlease pay before the due date to avoid a late penalty.\n\n`) +
    `Warm regards,\n${input.ownerName}\n${input.hostelName} Management\n` +
    (input.hostelPhone ? `Phone: ${input.hostelPhone}\n` : '') +
    (input.hostelEmail ? `Email: ${input.hostelEmail}\n` : '');
  return { subject, body };
};

const invoiceRow = (label: string, value: string, strong = false): string =>
  `<tr><td style="padding:10px 14px;color:#475569;font-size:14px;">${escapeInvoiceHtml(label)}</td>` +
  `<td style="padding:10px 14px;text-align:right;font-size:14px;color:#0f172a;${strong ? 'font-weight:800;' : 'font-weight:600;'}">${escapeInvoiceHtml(value)}</td></tr>`;

export const renderManualInvoiceHtml = (input: ManualInvoiceEmailInput): string => {
  const intro = invoiceIntroText(input.isDraftPreview, input.billingLabel, input.hostelName);
  const badge = input.isDraftPreview
    ? `<span style="display:inline-block;margin-left:10px;padding:4px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:800;">DRAFT PREVIEW</span>`
    : `<span style="display:inline-block;margin-left:10px;padding:4px 12px;border-radius:999px;background:#dcfce7;color:#166534;font-size:12px;font-weight:800;">FINAL INVOICE</span>`;
  const notice = input.isDraftPreview
    ? `<div style="margin:16px 0;padding:14px 16px;border-left:4px solid #f59e0b;background:#fffbeb;border-radius:8px;color:#92400e;font-size:13px;">This is a <strong>DRAFT preview</strong> — no payment is due yet.</div>`
    : `<div style="margin:16px 0;padding:14px 16px;border-left:4px solid #0ea5e9;background:#f0f9ff;border-radius:8px;color:#0c4a6e;font-size:13px;">Please pay <strong>${escapeInvoiceHtml(nprInvoice(input.totalPayable))}</strong> before <strong>${escapeInvoiceHtml(input.dueDateAd)}</strong>.</div>`;
  return (
    `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">` +
    `<div style="max-width:640px;margin:0 auto;padding:24px;">` +
    `<div style="background:linear-gradient(135deg,#7c2d12,#0f766e 55%,#0ea5e9);border-radius:16px 16px 0 0;padding:24px;color:#fff;">` +
    `<div style="font-size:12px;letter-spacing:2px;opacity:.85;">HOSTELGHAR • INVOICE</div>` +
    `<h1 style="margin:8px 0 4px;font-size:24px;">${escapeInvoiceHtml(input.hostelName)}${badge}</h1>` +
    `<div style="font-size:14px;opacity:.95;">${escapeInvoiceHtml(input.billingLabel)} • Due ${escapeInvoiceHtml(input.dueDateAd)}</div>` +
    `<div style="margin-top:10px;font-size:13px;">Hostel Owner: <strong>${escapeInvoiceHtml(input.ownerName)}</strong></div></div>` +
    `<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px;">` +
    `<p style="margin:0 0 6px;color:#0f172a;font-size:16px;">Dear <strong>${escapeInvoiceHtml(input.studentName)}</strong>,</p>` +
    `<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">${escapeInvoiceHtml(intro)}</p>` +
    `<table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">` +
    invoiceRow('Hostel', input.hostelName) +
    invoiceRow('Owner', input.ownerName) +
    (input.roomNumber ? invoiceRow('Room', input.roomNumber) : '') +
    (input.bedNumber ? invoiceRow('Bed', input.bedNumber) : '') +
    (input.billNo ? invoiceRow('Invoice No', input.billNo) : '') +
    invoiceRow('Billing Period', input.billingLabel) +
    invoiceRow('Invoice Amount', nprInvoice(input.amount)) +
    invoiceRow('Previous Outstanding Due', nprInvoice(input.outstandingDue)) +
    invoiceRow('Total Amount Payable', nprInvoice(input.totalPayable), true) +
    invoiceRow('Due Date (AD)', input.dueDateAd) +
    (input.dueDateBs ? invoiceRow('Due Date (BS)', input.dueDateBs) : '') +
    `</table>` +
    notice +
    `<div style="color:#475569;font-size:13px;line-height:1.7;">Warm regards,<br><strong>${escapeInvoiceHtml(input.ownerName)}</strong><br>${escapeInvoiceHtml(input.hostelName)} Management` +
    (input.hostelPhone ? `<br>Phone: ${escapeInvoiceHtml(input.hostelPhone)}` : '') +
    (input.hostelEmail ? `<br>Email: ${escapeInvoiceHtml(input.hostelEmail)}` : '') +
    `</div></div></div></body></html>`
  );
};

export const renderManualInvoiceEmail = (
  input: ManualInvoiceEmailInput,
): EmailTemplate & { html: string } => {
  const text = renderManualInvoiceText(input);
  return { ...text, html: renderManualInvoiceHtml(input) };
};
