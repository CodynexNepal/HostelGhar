// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.factory.ts
// PURPOSE: Factory to instantiate PaymentQrController with its dependencies.
// ──────────────────────────────────────────────────────────────────────────────

import { PaymentQrController } from '../../controller/payment-qr/payment-qr.controller';
import { PaymentQrRepository } from '../../repository/payment-qr/payment-qr.repository';
import { PaymentQrService } from '../../services/payment-qr/payment-qr.service';

export class PaymentQrFactory {
  private constructor() {}

  public static create(): PaymentQrController {
    const repository = new PaymentQrRepository();
    const service = new PaymentQrService(repository);
    return new PaymentQrController(service);
  }
}
