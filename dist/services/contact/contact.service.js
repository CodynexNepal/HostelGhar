"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactService = void 0;
const database_source_1 = require("../../database/database-source");
const contact_submission_entity_1 = require("../../entities/contact/contact-submission.entity");
const logger_1 = require("../../observability/logger");
class ContactService {
    constructor() {
        this.repo = database_source_1.AppDataSource.getRepository(contact_submission_entity_1.ContactSubmission);
    }
    async submitMessage(data) {
        const contact = this.repo.create({
            name: data.name.trim(),
            email: data.email.trim().toLowerCase(),
            phone: data.phone?.trim() || null,
            subject: data.subject?.trim() || 'General Inquiry',
            message: data.message.trim(),
            status: contact_submission_entity_1.ContactStatus.PENDING,
            ipAddress: data.ipAddress || null,
        });
        const saved = await this.repo.save(contact);
        logger_1.logger.info('New contact message submitted', { id: saved.id, email: saved.email });
        return saved;
    }
    async listMessages(page = 1, limit = 20) {
        const [messages, total] = await this.repo.findAndCount({
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { messages, total, page, limit };
    }
}
exports.ContactService = ContactService;
