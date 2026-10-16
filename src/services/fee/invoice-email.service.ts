// ─────────────────────────────────────────────────────────────
// FILE: invoice-email.service.ts
// PURPOSE: Queue the HostelGhar invoice email + socket push after SEND_NOW.
// ─────────────────────────────────────────────────────────────

import { Fee } from '../../entities/fee/fee.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { eventDispatcher } from '../../utils/event-dispatcher.util';
import { JobType, SocketEvent } from '../../constant/queue.constants';
import { socketServer } from '../../socket/socket.server';
import { renderManualInvoiceEmail } from '../../templates/invoice-email.template';

interface SendInvoiceEmailInput {
  fee: Fee;
  resident: Resident;
  hostel: Hostel;
  billingMonth: number;
  billingYear: number;
  amount: number;
  outstandingDue: number;
  totalPayable: number;
  dueDate: string;
  isDraftPreview: boolean;
  actorId: string;
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const sendInvoiceEmail = async (input: SendInvoiceEmailInput): Promise<string | null> => {
  const { fee, resident, hostel } = input;
  const recipient = resident.user?.email?.trim();
  if (!recipient) return null;

  const ownerName =
    `${hostel.owner?.firstName ?? ''} ${hostel.owner?.lastName ?? ''}`.trim() || 'Hostel Owner';
  const studentName =
    `${resident.user?.firstName ?? ''} ${resident.user?.lastName ?? ''}`.trim() || 'Student';
  const billingLabel = `${MONTH_SHORT[input.billingMonth - 1]} ${input.billingYear}`;

  const bill = renderManualInvoiceEmail({
    studentName,
    hostelName: hostel.name,
    ownerName,
    hostelAddress: hostel.address,
    hostelPhone: hostel.phone,
    hostelEmail: hostel.email,
    roomNumber: resident.roomNumber,
    bedNumber: resident.bedNumber,
    billingLabel,
    amount: input.amount,
    outstandingDue: input.outstandingDue,
    totalPayable: input.totalPayable,
    dueDateAd: input.dueDate,
    billNo: fee.id.slice(0, 8).toUpperCase(),
    isDraftPreview: input.isDraftPreview,
  });

  await eventDispatcher.queueEmail(JobType.SEND_INVOICE_EMAIL, {
    to: recipient,
    subject: bill.subject,
    body: bill.body,
    html: bill.html,
  });

  socketServer.toUser(resident.userId, SocketEvent.PAYMENT_PROCESSED, {
    title: input.isDraftPreview ? 'Invoice Preview Ready' : 'New Invoice Issued',
    message: input.isDraftPreview
      ? `A draft invoice preview for ${billingLabel} is ready at ${hostel.name}.`
      : `Your ${billingLabel} hostel invoice of NPR ${input.totalPayable} is due by ${input.dueDate}.`,
    feeId: fee.id,
    totalPayable: input.totalPayable,
  });

  return recipient;
};
