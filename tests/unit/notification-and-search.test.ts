import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../src/services/notification/notification.service';
import { SearchService } from '../../src/services/search/search.service';

describe('Notification & Unread Counter System', () => {
  it('correctly aggregates unread counts across categories without negative values', async () => {
    const mockRepo = {
      createNotification: vi.fn(),
      findById: vi.fn(),
      findByUser: vi.fn(),
      countUnreadByUser: vi.fn().mockResolvedValue(6),
      countUnreadByCategory: vi.fn().mockResolvedValue({
        total: 6,
        byCategory: {
          booking: 3,
          bookings: 3,
          resident: 2,
          residents: 2,
          payment: 1,
          payments: 1,
          complaint: 0,
          complaints: 0,
          hostel: 0,
          hostels: 0,
          user: 0,
          users: 0,
        },
      }),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn().mockResolvedValue(3),
      deleteNotification: vi.fn(),
    };

    const service = new NotificationService(mockRepo as any);
    const counts = await service.getUnreadCounts('test-user-id');

    expect(counts.total).toBe(6);
    expect(counts.byCategory.bookings).toBe(3);
    expect(counts.byCategory.residents).toBe(2);
    expect(counts.byCategory.payments).toBe(1);
    expect(counts.byCategory.complaints).toBe(0);
    expect(counts.total).toBeGreaterThanOrEqual(0);
  });

  it('marks all notifications of a specific entityType as read and updates count', async () => {
    const mockRepo = {
      createNotification: vi.fn(),
      findById: vi.fn(),
      findByUser: vi.fn(),
      countUnreadByUser: vi.fn().mockResolvedValue(3),
      countUnreadByCategory: vi.fn().mockResolvedValue({
        total: 3,
        byCategory: {
          booking: 0,
          bookings: 0,
          resident: 2,
          residents: 2,
          payment: 1,
          payments: 1,
        },
      }),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn().mockResolvedValue(3),
      deleteNotification: vi.fn(),
    };

    const service = new NotificationService(mockRepo as any);
    const result = await service.markAllAsRead('test-user-id', 'booking');

    expect(mockRepo.markAllAsRead).toHaveBeenCalledWith('test-user-id', 'booking', undefined);
    expect(result.updatedCount).toBe(3);
    expect(result.counts.total).toBe(3);
    expect(result.counts.byCategory.bookings).toBe(0);
  });

  it('handles empty search queries gracefully without database overhead', async () => {
    const searchService = new SearchService();
    const result = await searchService.search('user-id', 'HOSTEL_OWNER', '   ');

    expect(result.query).toBe('');
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
    expect(result.categories).toEqual({});
  });
});
