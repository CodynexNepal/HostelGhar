import { describe, expect, it, vi } from 'vitest';
import { HostelService } from '../../src/services/hostel/hostel.service';
import { STATUS_CODE } from '../../src/constant/statusCode.interface';
import { HostelRating } from '../../src/entities/rating/hostel-rating.entity';

describe('HostelRating Entity & Service logic', () => {
  it('validates rating entity structure', () => {
    const rating = new HostelRating();
    rating.id = '123e4567-e89b-12d3-a456-426614174000';
    rating.hostelId = '123e4567-e89b-12d3-a456-426614174001';
    rating.userId = '123e4567-e89b-12d3-a456-426614174002';
    rating.rating = 5;
    rating.comment = 'Excellent facilities and clean rooms!';

    expect(rating.rating).toBe(5);
    expect(rating.comment).toBe('Excellent facilities and clean rooms!');
    expect(rating.hostelId).toBe('123e4567-e89b-12d3-a456-426614174001');
  });

  it('rejects invalid rating values (< 1 or > 5)', async () => {
    const mockRepo = {} as any;
    const service = new HostelService(mockRepo);

    const resLow = await service.addRating('hostel-1', 0);
    expect(resLow.error?.status).toBe(STATUS_CODE.BAD_REQUEST);

    const resHigh = await service.addRating('hostel-1', 6);
    expect(resHigh.error?.status).toBe(STATUS_CODE.BAD_REQUEST);
  });

  it('handles not found hostel', async () => {
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(null),
    } as any;
    const service = new HostelService(mockRepo);

    const result = await service.addRating('non-existent-hostel', 4);
    expect(result.error?.status).toBe(STATUS_CODE.NOT_FOUND);
  });

  it('successfully records rating and updates stats', async () => {
    const mockRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'hostel-1' }),
      createOrUpdateRating: vi.fn().mockResolvedValue({
        id: 'rating-1',
        hostelId: 'hostel-1',
        userId: 'user-1',
        rating: 5,
        comment: 'Great place',
      }),
      getRatingStatsByHostelId: vi.fn().mockResolvedValue({
        total: 10,
        averageRating: 4.7,
      }),
    } as any;
    const service = new HostelService(mockRepo);

    const result = await service.addRating('hostel-1', 5, 'Great place', 'user-1');
    expect(result.data?.averageRating).toBe(4.7);
    expect(result.data?.totalReviews).toBe(10);
    expect(result.data?.rating).toBe(5);
    expect(mockRepo.createOrUpdateRating).toHaveBeenCalledWith({
      hostelId: 'hostel-1',
      userId: 'user-1',
      rating: 5,
      comment: 'Great place',
    });
  });
});

