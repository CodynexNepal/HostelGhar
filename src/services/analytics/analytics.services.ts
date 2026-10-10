import { AnalyticsRepository } from '../../repository/analytics/analytics.repository';
import { cacheService } from '../../utils/cache.util';

export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  /**
   * Admin dashboard bootstrap. Served from the 3-tier cache like the legacy
   * summary, but `refresh: true` (the dashboard's Refresh button) bypasses L1/L2
   * so the admin always sees committed rows instead of a 120s-stale card.
   */
  public async getAdminDashboard(options: { refresh?: boolean } = {}) {
    // v3: adds the stats/pendingApprovals/recentHostels/health blocks, so an
    // older L2 entry must never be served to the new client.
    const cacheKey = cacheService.generateKey('analytics', { name: 'admin-dashboard', v: 4 });
    const fresh = options.refresh === true;

    return await cacheService.wrap(
      cacheKey,
      async () => await this.analyticsRepository.getAdminDashboard(),
      { l1TtlSeconds: 30, l2TtlSeconds: 120, skipL1: fresh, skipL2: fresh },
    );
  }

  /**
   * Kept for the legacy `/admin/dashboard/summary` and `/analytics/admin/summary`
   * routes so an existing client gets the SAME payload — including MRR — as
   * `/admin/dashboard`. It delegates instead of running a second, thinner query,
   * so all three endpoints share one cache entry and never disagree.
   */
  public async getAdminSummary(options: { refresh?: boolean } = {}) {
    return await this.getAdminDashboard(options);
  }

  public async getOwnerSummary(ownerId: string) {
    // Bump the response version whenever its shape changes, so an L2 cache entry
    // created by an older server cannot be returned to the analytics client.
    const cacheKey = cacheService.generateKey('analytics:owner', { ownerId, v: 3 });

    return await cacheService.wrap(
      cacheKey,
      async () => await this.analyticsRepository.getOwnerSummary(ownerId),
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );
  }
}
