"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostelLikeController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
class HostelLikeController {
    constructor(likeService) {
        this.likeService = likeService;
        this.toggleLike = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const clientIdentifier = this.getClientIdentifier(req);
                const userId = req.user?.userId || null;
                const ipAddress = req.ip || req.socket.remoteAddress || null;
                const result = await this.likeService.toggleLike({
                    hostelId,
                    clientIdentifier,
                    userId,
                    ipAddress,
                });
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: result.liked ? 'Hostel added to your favorites' : 'Hostel removed from favorites',
                    data: result,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getUserLikedHostels = async (req, res, next) => {
            try {
                const clientIdentifier = this.getClientIdentifier(req);
                const userId = req.user?.userId || null;
                const [hostelIds, hostels] = await Promise.all([
                    this.likeService.getUserLikedHostelIds(clientIdentifier, userId),
                    this.likeService.getUserLikedHostels(clientIdentifier, userId),
                ]);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: {
                        likedHostelIds: hostelIds,
                        hostels,
                        total: hostelIds.length,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getHostelLikeStats = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'id');
                const clientIdentifier = this.getClientIdentifier(req);
                const userId = req.user?.userId || null;
                const stats = await this.likeService.getHostelLikeStats(hostelId, clientIdentifier, userId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data: stats,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
    getClientIdentifier(req) {
        if (req.user?.userId) {
            return `usr_${req.user.userId}`;
        }
        const paramClientId = (req.body?.clientId || req.query?.clientId);
        if (paramClientId && typeof paramClientId === 'string' && paramClientId.trim().length > 0) {
            return `cli_${paramClientId.trim()}`;
        }
        const headerClientId = req.headers['x-client-id'];
        if (headerClientId && headerClientId.trim().length > 0) {
            return `cli_${headerClientId.trim()}`;
        }
        const cookieClientId = req.cookies?.guest_client_id;
        if (cookieClientId && cookieClientId.trim().length > 0) {
            return `cli_${cookieClientId.trim()}`;
        }
        const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
        return `ip_${ip}`;
    }
}
exports.HostelLikeController = HostelLikeController;
