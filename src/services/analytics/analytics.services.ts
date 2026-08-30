import { AnalyticsRepository } from '../../repository/analytics/analytics.repository';

export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  public getAdminSummary() {
    return this.analyticsRepository.getAdminSummary();
  }

  public getOwnerSummary(ownerId: string) {
    return this.analyticsRepository.getOwnerSummary(ownerId);
  }
}
