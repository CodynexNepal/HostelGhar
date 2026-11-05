import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { ContactSubmission, ContactStatus } from '../../entities/contact/contact-submission.entity';
import { logger } from '../../observability/logger';

export interface CreateContactDTO {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  ipAddress?: string | null;
}

export class ContactService {
  private repo: Repository<ContactSubmission>;

  constructor() {
    this.repo = AppDataSource.getRepository(ContactSubmission);
  }

  public async submitMessage(data: CreateContactDTO): Promise<ContactSubmission> {
    const contact = this.repo.create({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      subject: data.subject?.trim() || 'General Inquiry',
      message: data.message.trim(),
      status: ContactStatus.PENDING,
      ipAddress: data.ipAddress || null,
    });

    const saved = await this.repo.save(contact);
    logger.info('New contact message submitted', { id: saved.id, email: saved.email });
    return saved;
  }

  public async listMessages(page: number = 1, limit: number = 20) {
    const [messages, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { messages, total, page, limit };
  }

  public async updateStatus(id: string, status: ContactStatus): Promise<ContactSubmission | null> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) return null;
    item.status = status;
    return this.repo.save(item);
  }

  public async deleteMessage(id: string): Promise<boolean> {
    const res = await this.repo.delete({ id });
    return (res.affected ?? 0) > 0;
  }
}
