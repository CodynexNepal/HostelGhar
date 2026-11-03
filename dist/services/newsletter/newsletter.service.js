"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterService = void 0;
const database_source_1 = require("../../database/database-source");
const newsletter_subscription_entity_1 = require("../../entities/newsletter/newsletter-subscription.entity");
const logger_1 = require("../../observability/logger");
class NewsletterService {
    constructor() {
        this.repo = database_source_1.AppDataSource.getRepository(newsletter_subscription_entity_1.NewsletterSubscription);
    }
    async subscribe(email, source = 'footer', ipAddress) {
        const cleanEmail = email.trim().toLowerCase();
        let existing = await this.repo.findOne({ where: { email: cleanEmail } });
        if (existing) {
            if (existing.status !== newsletter_subscription_entity_1.NewsletterStatus.ACTIVE) {
                existing.status = newsletter_subscription_entity_1.NewsletterStatus.ACTIVE;
                existing.source = source;
                await this.repo.save(existing);
            }
            return { subscription: existing, isNew: false };
        }
        const created = this.repo.create({
            email: cleanEmail,
            status: newsletter_subscription_entity_1.NewsletterStatus.ACTIVE,
            source,
            ipAddress: ipAddress || null,
        });
        const saved = await this.repo.save(created);
        logger_1.logger.info('New newsletter subscription', { email: saved.email, source });
        return { subscription: saved, isNew: true };
    }
    async unsubscribe(email) {
        const cleanEmail = email.trim().toLowerCase();
        const existing = await this.repo.findOne({ where: { email: cleanEmail } });
        if (!existing)
            return false;
        existing.status = newsletter_subscription_entity_1.NewsletterStatus.UNSUBSCRIBED;
        await this.repo.save(existing);
        return true;
    }
    async listSubscriptions(page = 1, limit = 50) {
        const [subscribers, total] = await this.repo.findAndCount({
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { subscribers, total, page, limit };
    }
}
exports.NewsletterService = NewsletterService;
