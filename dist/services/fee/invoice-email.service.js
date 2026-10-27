"use strict";
// ─────────────────────────────────────────────────────────────
// FILE: invoice-email.service.ts
// PURPOSE: Queue the HostelGhar invoice email + socket push after SEND_NOW.
// ─────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInvoiceEmail = void 0;
const event_dispatcher_util_1 = require("../../utils/event-dispatcher.util");
const queue_constants_1 = require("../../constant/queue.constants");
const socket_server_1 = require("../../socket/socket.server");
const invoice_email_template_1 = require("../../templates/invoice-email.template");
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
const sendInvoiceEmail = async (input) => {
    const { fee, resident, hostel } = input;
    const recipient = resident.user?.email?.trim();
    if (!recipient)
        return null;
    const ownerName = `${hostel.owner?.firstName ?? ''} ${hostel.owner?.lastName ?? ''}`.trim() || 'Hostel Owner';
    const studentName = `${resident.user?.firstName ?? ''} ${resident.user?.lastName ?? ''}`.trim() || 'Student';
    const billingLabel = `${MONTH_SHORT[input.billingMonth - 1]} ${input.billingYear}`;
    const bill = (0, invoice_email_template_1.renderManualInvoiceEmail)({
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
    await event_dispatcher_util_1.eventDispatcher.queueEmail(queue_constants_1.JobType.SEND_INVOICE_EMAIL, {
        to: recipient,
        subject: bill.subject,
        body: bill.body,
        html: bill.html,
    });
    socket_server_1.socketServer.toUser(resident.userId, queue_constants_1.SocketEvent.PAYMENT_PROCESSED, {
        title: input.isDraftPreview ? 'Invoice Preview Ready' : 'New Invoice Issued',
        message: input.isDraftPreview
            ? `A draft invoice preview for ${billingLabel} is ready at ${hostel.name}.`
            : `Your ${billingLabel} hostel invoice of NPR ${input.totalPayable} is due by ${input.dueDate}.`,
        feeId: fee.id,
        totalPayable: input.totalPayable,
    });
    return recipient;
};
exports.sendInvoiceEmail = sendInvoiceEmail;
