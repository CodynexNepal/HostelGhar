"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostelListingService = void 0;
const database_source_1 = require("../../database/database-source");
const hostel_listing_request_entity_1 = require("../../entities/hostel-listing/hostel-listing-request.entity");
const logger_1 = require("../../observability/logger");
class HostelListingService {
    constructor() {
        this.repo = database_source_1.AppDataSource.getRepository(hostel_listing_request_entity_1.HostelListingRequest);
    }
    async submitListingRequest(data) {
        const listing = this.repo.create({
            hostelName: data.hostelName.trim(),
            type: data.type || 'coed',
            totalBeds: Number(data.totalBeds) || 0,
            phone: data.phone.trim(),
            city: data.city.trim(),
            area: data.area?.trim() || null,
            address: data.address.trim(),
            priceFrom: data.priceFrom ? Number(data.priceFrom) : null,
            negotiable: Boolean(data.negotiable),
            amenities: Array.isArray(data.amenities) ? data.amenities : [],
            description: data.description?.trim() || null,
            rules: data.rules?.trim() || null,
            photos: Array.isArray(data.photos) ? data.photos : [],
            ownerName: data.ownerName.trim(),
            email: data.email.trim().toLowerCase(),
            status: hostel_listing_request_entity_1.ListingRequestStatus.PENDING,
            ipAddress: data.ipAddress || null,
        });
        const saved = await this.repo.save(listing);
        logger_1.logger.info('New hostel listing application submitted', {
            id: saved.id,
            hostelName: saved.hostelName,
            ownerEmail: saved.email,
        });
        return saved;
    }
    async listRequests(page = 1, limit = 20) {
        const [requests, total] = await this.repo.findAndCount({
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { requests, total, page, limit };
    }
}
exports.HostelListingService = HostelListingService;
