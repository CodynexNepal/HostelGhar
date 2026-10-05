// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.repository.ts
// PURPOSE: Data access layer for subscriptions, plan querying, and limit checks.
// ──────────────────────────────────────────────────────────────────────────────

import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Subscription } from '../../entities/subscription/subscription.entity';
import { Resident } from '../../entities/resident/resident.entity';
import { Hostel } from '../../entities/hostel/hostel.entity';
import { SubscriptionStatus } from '../../enum/subscription.enum';

export class SubscriptionRepository {
  private readonly subRepo: Repository<Subscription>;
  private readonly residentRepo: Repository<Resident>;
  private readonly hostelRepo: Repository<Hostel>;

  constructor() {
    this.subRepo = AppDataSource.getRepository(Subscription);
    this.residentRepo = AppDataSource.getRepository(Resident);
    this.hostelRepo = AppDataSource.getRepository(Hostel);
  }

  public create(data: Partial<Subscription>): Subscription {
    return this.subRepo.create(data);
  }

  public async save(subscription: Subscription): Promise<Subscription> {
    return this.subRepo.save(subscription);
  }

  public async findById(id: string): Promise<Subscription | null> {
    return this.subRepo.findOne({
      where: { id },
      relations: { owner: true, hostel: true },
    });
  }

  /**
   * Finds the latest active subscription for an owner (or hostel).
   */
  public async findActiveSubscription(params: {
    ownerId?: string | undefined;
    hostelId?: string | undefined;
  }): Promise<Subscription | null> {
    const qb = this.subRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.hostel', 'hostel')
      .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('(sub.endDate IS NULL OR sub.endDate >= NOW())');

    if (params.hostelId && params.ownerId) {
      qb.andWhere('(sub.hostelId = :hostelId OR sub.ownerId = :ownerId)', {
        hostelId: params.hostelId,
        ownerId: params.ownerId,
      });
    } else if (params.hostelId) {
      qb.andWhere('sub.hostelId = :hostelId', { hostelId: params.hostelId });
    } else if (params.ownerId) {
      qb.andWhere('sub.ownerId = :ownerId', { ownerId: params.ownerId });
    } else {
      return null;
    }

    qb.orderBy('sub.createdAt', 'DESC');
    return qb.getOne();
  }

  /**
   * Retrieves all subscription records for an owner.
   */
  public async findByOwner(ownerId: string): Promise<Subscription[]> {
    return this.subRepo.find({
      where: { ownerId },
      relations: { hostel: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Cancels/deactivates existing active subscriptions when an owner upgrades or cancels.
   */
  public async deactivateExistingActive(ownerId: string, hostelId?: string | null): Promise<void> {
    const qb = this.subRepo
      .createQueryBuilder()
      .update(Subscription)
      .set({
        status: SubscriptionStatus.EXPIRED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where('ownerId = :ownerId', { ownerId })
      .andWhere('status = :status', { status: SubscriptionStatus.ACTIVE });

    if (hostelId) {
      qb.andWhere('(hostelId = :hostelId OR hostelId IS NULL)', { hostelId });
    }

    await qb.execute();
  }

  /**
   * Counts currently active residents in a hostel.
   */
  public async countActiveResidents(hostelId: string): Promise<number> {
    return this.residentRepo.count({
      where: { hostelId, isActive: true },
    });
  }

  /**
   * Counts total hostels owned by an owner.
   */
  public async countOwnerHostels(ownerId: string): Promise<number> {
    return this.hostelRepo.count({
      where: { ownerId },
    });
  }

  /**
   * Finds hostel by ID.
   */
  public async findHostelById(hostelId: string): Promise<Hostel | null> {
    return this.hostelRepo.findOne({
      where: { id: hostelId },
    });
  }

  /**
   * Latest PENDING request (payment proof awaiting admin review) for an
   * owner + hostel. Used to block duplicate upgrade requests.
   */
  public async findPendingRequest(
    ownerId: string,
    hostelId?: string | null,
  ): Promise<Subscription | null> {
    return this.subRepo.findOne({
      where: hostelId
        ? { ownerId, status: SubscriptionStatus.PENDING, hostelId }
        : { ownerId, status: SubscriptionStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Admin review queue: PENDING (or filtered) subscription requests, newest
   * first, with owner + hostel denormalized for the dashboard table.
   */
  public async listRequests(options: {
    status?: SubscriptionStatus | undefined;
    page: number;
    limit: number;
  }): Promise<{ rows: Subscription[]; total: number }> {
    const where: { status?: SubscriptionStatus } = {};
    if (options.status) where.status = options.status;

    const [rows, total] = await this.subRepo.findAndCount({
      where,
      relations: { owner: true, hostel: true, reviewedByUser: true },
      order: { createdAt: 'DESC' },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });

    return { rows, total };
  }
}
