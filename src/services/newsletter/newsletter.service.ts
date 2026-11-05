import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import {
  NewsletterSubscription,
  NewsletterStatus,
} from '../../entities/newsletter/newsletter-subscription.entity';
import { logger } from '../../observability/logger';

export class NewsletterService {
  private repo: Repository<NewsletterSubscription>;

  constructor() {
    this.repo = AppDataSource.getRepository(NewsletterSubscription);
  }

  public async subscribe(
    email: string,
    source: string = 'footer',
    ipAddress?: string | null,
  ): Promise<{ subscription: NewsletterSubscription; isNew: boolean }> {
    const cleanEmail = email.trim().toLowerCase();

    let existing = await this.repo.findOne({ where: { email: cleanEmail } });

    if (existing) {
      if (existing.status !== NewsletterStatus.ACTIVE) {
        existing.status = NewsletterStatus.ACTIVE;
        existing.source = source;
        await this.repo.save(existing);
      }
      return { subscription: existing, isNew: false };
    }

    const created = this.repo.create({
      email: cleanEmail,
      status: NewsletterStatus.ACTIVE,
      source,
      ipAddress: ipAddress || null,
    });

    const saved = await this.repo.save(created);
    logger.info('New newsletter subscription', { email: saved.email, source });
    return { subscription: saved, isNew: true };
  }

  public async unsubscribe(email: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await this.repo.findOne({ where: { email: cleanEmail } });
    if (!existing) return false;
    existing.status = NewsletterStatus.UNSUBSCRIBED;
    await this.repo.save(existing);
    return true;
  }

  public async listSubscriptions(page: number = 1, limit: number = 50) {
    const [subscribers, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { subscribers, total, page, limit };
  }

  public async deleteSubscription(id: string): Promise<boolean> {
    const res = await this.repo.delete({ id });
    return (res.affected ?? 0) > 0;
  }

  public async updateStatus(
    id: string,
    status: NewsletterStatus,
  ): Promise<NewsletterSubscription | null> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) return null;
    item.status = status;
    return this.repo.save(item);
  }
}
