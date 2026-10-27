"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const invoice_service_1 = require("../../services/fee/invoice.service");
class InvoiceController {
    constructor(invoiceService = new invoice_service_1.InvoiceService()) {
        this.invoiceService = invoiceService;
        /**
         * POST /fees/invoices — Owner/Admin creates one resident invoice for a hostel.
         * DRAFT saves a PENDING fee silently; SEND_NOW also queues the HostelGhar
         * invoice email + socket push to the resident.
         */
        this.createInvoice = async (req, res, next) => {
            try {
                const body = req.body;
                if (body.hostelId === undefined || body.hostelId === null || body.hostelId === '') {
                    const fromQuery = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
                    const fromHeader = typeof req.headers['x-hostel-id'] === 'string' ? req.headers['x-hostel-id'] : undefined;
                    const resolved = fromQuery ?? fromHeader;
                    if (resolved)
                        body.hostelId = resolved;
                }
                const result = await this.invoiceService.createInvoice(req.user.userId, req.user.role, req.body);
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: result.sendMode === 'SEND_NOW'
                        ? result.emailSent
                            ? `Invoice created and emailed to ${result.emailQueuedTo}`
                            : 'Invoice created (resident has no email on file, so no email was queued)'
                        : 'Draft invoice saved (no email sent)',
                    data: result.fee,
                    meta: {
                        sendMode: result.sendMode,
                        emailSent: result.emailSent,
                        emailQueuedTo: result.emailQueuedTo,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.InvoiceController = InvoiceController;
