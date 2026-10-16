import { NextFunction, Request, Response } from 'express';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CreateInvoiceDto } from '../../dto/fee/create-invoice.dto';
import { InvoiceService } from '../../services/fee/invoice.service';

export class InvoiceController {
  constructor(private readonly invoiceService = new InvoiceService()) {}

  /**
   * POST /fees/invoices — Owner/Admin creates one resident invoice for a hostel.
   * DRAFT saves a PENDING fee silently; SEND_NOW also queues the HostelGhar
   * invoice email + socket push to the resident.
   */
  public createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      if (body.hostelId === undefined || body.hostelId === null || body.hostelId === '') {
        const fromQuery = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
        const fromHeader =
          typeof req.headers['x-hostel-id'] === 'string' ? req.headers['x-hostel-id'] : undefined;
        const resolved = fromQuery ?? fromHeader;
        if (resolved) body.hostelId = resolved;
      }
      const result = await this.invoiceService.createInvoice(
        req.user!.userId,
        req.user!.role,
        req.body as CreateInvoiceDto,
      );
      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message:
          result.sendMode === 'SEND_NOW'
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
    } catch (error) {
      next(error);
    }
  };
}
