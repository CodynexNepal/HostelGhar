import { AnalyticsController } from '../../controller/analytics/analytics.controller';
import { AnalyticsRepository } from '../../repository/analytics/analytics.repository';
import { AnalyticsService } from '../../services/analytics/analytics.services';

export class AnalyticsFactory {
  private constructor() {}

  public static create(): AnalyticsController {
    const analyticsRepository = new AnalyticsRepository();
    const analyticsService = new AnalyticsService(analyticsRepository);
    return new AnalyticsController(analyticsService);
  }
}
