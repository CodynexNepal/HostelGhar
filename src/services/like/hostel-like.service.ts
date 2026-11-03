import { HostelLikeRepository } from '../../repository/like/hostel-like.repository';

export class HostelLikeService {
  constructor(private readonly likeRepository: HostelLikeRepository) {}

  public async toggleLike(params: {
    hostelId: string;
    clientIdentifier: string;
    userId?: string | null;
    ipAddress?: string | null;
  }) {
    return await this.likeRepository.toggleLike(
      params.hostelId,
      params.clientIdentifier,
      params.userId,
      params.ipAddress,
    );
  }

  public async getUserLikedHostelIds(clientIdentifier: string, userId?: string | null) {
    return await this.likeRepository.getUserLikedHostelIds(clientIdentifier, userId);
  }

  public async getUserLikedHostels(clientIdentifier: string, userId?: string | null) {
    return await this.likeRepository.getUserLikedHostels(clientIdentifier, userId);
  }

  public async getHostelLikeStats(
    hostelId: string,
    clientIdentifier: string,
    userId?: string | null,
  ) {
    const [likeCount, isLiked] = await Promise.all([
      this.likeRepository.getHostelLikeCount(hostelId),
      this.likeRepository.isHostelLiked(hostelId, clientIdentifier, userId),
    ]);

    return { likeCount, isLiked };
  }
}
