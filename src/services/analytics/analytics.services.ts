import { AnalyticsRepository } from '../../repository/analytics/analytics.repository';
import { cacheService } from '../../utils/cache.util';

export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  public async getAdminSummary() {
    const cacheKey = cacheService.generateKey('analytics', 'admin-summary');

    // 3-Level Cache: L1 (LRU RAM) -> L2 (Redis) -> L3 (DB)
    return await cacheService.wrap(
      cacheKey,
      async () => await this.analyticsRepository.getAdminSummary(),
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );
  }

  public async getOwnerSummary(ownerId: string) {
    const cacheKey = cacheService.generateKey('analytics:owner', ownerId);

    return await cacheService.wrap(
      cacheKey,
      async () => await this.analyticsRepository.getOwnerSummary(ownerId),
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );
  }
}
