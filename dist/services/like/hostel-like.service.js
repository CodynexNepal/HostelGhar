"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostelLikeService = void 0;
class HostelLikeService {
    constructor(likeRepository) {
        this.likeRepository = likeRepository;
    }
    async toggleLike(params) {
        return await this.likeRepository.toggleLike(params.hostelId, params.clientIdentifier, params.userId, params.ipAddress);
    }
    async getUserLikedHostelIds(clientIdentifier, userId) {
        return await this.likeRepository.getUserLikedHostelIds(clientIdentifier, userId);
    }
    async getUserLikedHostels(clientIdentifier, userId) {
        return await this.likeRepository.getUserLikedHostels(clientIdentifier, userId);
    }
    async getHostelLikeStats(hostelId, clientIdentifier, userId) {
        const [likeCount, isLiked] = await Promise.all([
            this.likeRepository.getHostelLikeCount(hostelId),
            this.likeRepository.isHostelLiked(hostelId, clientIdentifier, userId),
        ]);
        return { likeCount, isLiked };
    }
}
exports.HostelLikeService = HostelLikeService;
