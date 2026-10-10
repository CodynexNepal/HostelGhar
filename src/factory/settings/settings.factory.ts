import { SettingsController } from '../../controller/settings/settings.controller';
import { SettingsRepository } from '../../repository/settings/settings.repository';
import { SettingsService } from '../../services/settings/settings.service';

export class SettingsFactory {
  private constructor() {}

  public static create(): SettingsController {
    const repository = new SettingsRepository();
    const service = new SettingsService(repository);
    return new SettingsController(service);
  }
}
