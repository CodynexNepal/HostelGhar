// ──────────────────────────────────────────────────────────────────────────────
// FILE: location.factory.ts
// PURPOSE: Factory for initializing LocationController with its dependencies.
// ──────────────────────────────────────────────────────────────────────────────

import { LocationController } from '../../controller/location/location.controller';
import { LocationService } from '../../services/location/location.service';

export class LocationFactory {
  private constructor() {}

  public static create(): LocationController {
    const service = new LocationService();
    return new LocationController(service);
  }
}
