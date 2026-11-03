import { Request, Response, NextFunction } from 'express';
import { HostelLikeService } from '../../services/like/hostel-like.service';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { getRequiredParam } from '../../decorators/http.decorator';

export class HostelLikeController {
  constructor(private readonly likeService: HostelLikeService) {}

  private getClientIdentifier(req: Request): string {
    if (req.user?.userId) {
      return `usr_${req.user.userId}`;
    }
    const headerClientId = req.headers['x-client-id'] as string;
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

  public toggleLike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      const clientIdentifier = this.getClientIdentifier(req);
      const userId = req.user?.userId || null;
      const ipAddress = req.ip || req.socket.remoteAddress || null;

      const result = await this.likeService.toggleLike({
        hostelId,
        clientIdentifier,
        userId,
        ipAddress,
      });

      res.status(STATUS_CODE.OK).json({
        success: true,
        message: result.liked ? 'Hostel added to your favorites' : 'Hostel removed from favorites',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getUserLikedHostels = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const clientIdentifier = this.getClientIdentifier(req);
      const userId = req.user?.userId || null;

      const [hostelIds, hostels] = await Promise.all([
        this.likeService.getUserLikedHostelIds(clientIdentifier, userId),
        this.likeService.getUserLikedHostels(clientIdentifier, userId),
      ]);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: {
          likedHostelIds: hostelIds,
          hostels,
          total: hostelIds.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getHostelLikeStats = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const hostelId = getRequiredParam(req, 'id');
      const clientIdentifier = this.getClientIdentifier(req);
      const userId = req.user?.userId || null;

      const stats = await this.likeService.getHostelLikeStats(hostelId, clientIdentifier, userId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };
}
