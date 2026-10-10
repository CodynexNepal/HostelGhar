// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.factory.ts
// PURPOSE: Factory to instantiate PlatformQrController with its dependencies.
// ──────────────────────────────────────────────────────────────────────────────

import { PlatformQrController } from '../../controller/platform-qr/platform-qr.controller';
import { PlatformQrRepository } from '../../repository/platform-qr/platform-qr.repository';
import { PlatformQrService } from '../../services/platform-qr/platform-qr.service';

export class PlatformQrFactory {
  private constructor() {}

  public static create(): PlatformQrController {
    const repository = new PlatformQrRepository();
    const service = new PlatformQrService(repository);
    return new PlatformQrController(service);
  }
}
