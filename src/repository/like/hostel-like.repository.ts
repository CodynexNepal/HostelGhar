import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { HostelLike } from '../../entities/like/hostel-like.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';

export class HostelLikeRepository {
  private repo: Repository<HostelLike>;
  private hostelRepo: Repository<Hostel>;

  constructor() {
    this.repo = AppDataSource.getRepository(HostelLike);
    this.hostelRepo = AppDataSource.getRepository(Hostel);
  }

  public async toggleLike(
    hostelId: string,
    clientIdentifier: string,
    userId: string | null = null,
    ipAddress: string | null = null,
  ): Promise<{ liked: boolean; likeCount: number }> {
    // Check if like exists for this hostel and client/user
    const query = this.repo
      .createQueryBuilder('like')
      .where('like.hostelId = :hostelId', { hostelId });

    if (userId) {
      query.andWhere('(like.userId = :userId OR like.clientIdentifier = :clientIdentifier)', {
        userId,
        clientIdentifier,
      });
    } else {
      query.andWhere('like.clientIdentifier = :clientIdentifier', { clientIdentifier });
    }

    const existing = await query.getOne();

    if (existing) {
      await this.repo.remove(existing);
      const likeCount = await this.repo.count({ where: { hostelId } });
      return { liked: false, likeCount };
    }

    const newLike = this.repo.create({
      hostelId,
      clientIdentifier,
      userId: userId || null,
      ipAddress: ipAddress || null,
    });
    await this.repo.save(newLike);

    const likeCount = await this.repo.count({ where: { hostelId } });
    return { liked: true, likeCount };
  }

  public async getUserLikedHostelIds(
    clientIdentifier: string,
    userId: string | null = null,
  ): Promise<string[]> {
    const qb = this.repo
      .createQueryBuilder('like')
      .select('like.hostelId', 'hostelId')
      .distinct(true);

    if (userId) {
      qb.where('like.userId = :userId OR like.clientIdentifier = :clientIdentifier', {
        userId,
        clientIdentifier,
      });
    } else {
      qb.where('like.clientIdentifier = :clientIdentifier', { clientIdentifier });
    }

    const rows = await qb.getRawMany<{ hostelId: string }>();
    return rows.map((r) => r.hostelId);
  }

  public async getUserLikedHostels(
    clientIdentifier: string,
    userId: string | null = null,
  ): Promise<any[]> {
    const hostelIds = await this.getUserLikedHostelIds(clientIdentifier, userId);
    if (!hostelIds.length) {
      return [];
    }

    const hostels = await this.hostelRepo
      .createQueryBuilder('hostel')
      .leftJoinAndSelect('hostel.hostelFacilities', 'hostelFacility')
      .leftJoinAndSelect('hostelFacility.facility', 'facility')
      .where('hostel.id IN (:...hostelIds)', { hostelIds })
      .getMany();

    return hostels.map((h) => ({
      id: h.id,
      name: h.name,
      type: h.type,
      city: h.city,
      address: h.address,
      phone: h.phone,
      email: h.email,
      logoUrl: h.logoUrl,
      facilities: h.hostelFacilities?.map((hf) => hf.facility?.title).filter(Boolean) || [],
    }));
  }

  public async getHostelLikeCount(hostelId: string): Promise<number> {
    return await this.repo.count({ where: { hostelId } });
  }

  public async isHostelLiked(
    hostelId: string,
    clientIdentifier: string,
    userId: string | null = null,
  ): Promise<boolean> {
    const qb = this.repo
      .createQueryBuilder('like')
      .where('like.hostelId = :hostelId', { hostelId });

    if (userId) {
      qb.andWhere('(like.userId = :userId OR like.clientIdentifier = :clientIdentifier)', {
        userId,
        clientIdentifier,
      });
    } else {
      qb.andWhere('like.clientIdentifier = :clientIdentifier', { clientIdentifier });
    }

    const count = await qb.getCount();
    return count > 0;
  }
}
