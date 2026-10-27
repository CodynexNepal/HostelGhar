"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: facility.repository.ts
// PURPOSE: Data access for normalized facilities.
//          - facilities: canonical catalog keyed by slug
//          - hostel_facilities: per-hostel junction rows (description/tag/clientKey)
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacilityRepository = exports.toFacilitySlug = void 0;
const typeorm_1 = require("typeorm");
const database_source_1 = require("../../database/database-source");
const facility_entity_1 = require("../../entities/facility/facility.entity");
const hostel_facility_entity_1 = require("../../entities/facility/hostel-facility.entity");
/** Normalize a title into a dedupe slug: " High-Speed Wifi " -> "high-speed-wifi". */
const toFacilitySlug = (title) => title
    .trim()
    .toLowerCase()
    .replace(/[_'’`]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
exports.toFacilitySlug = toFacilitySlug;
class FacilityRepository {
    constructor() {
        this.facilityRepo = database_source_1.AppDataSource.getRepository(facility_entity_1.Facility);
        this.hostelFacilityRepo = database_source_1.AppDataSource.getRepository(hostel_facility_entity_1.HostelFacility);
    }
    async listByHostel(hostelId) {
        return this.hostelFacilityRepo.find({
            where: { hostelId },
            relations: { facility: true },
            order: { createdAt: 'ASC' },
        });
    }
    async findCatalogBySlugs(slugs) {
        const unique = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))];
        if (unique.length === 0)
            return [];
        return this.facilityRepo.find({ where: { slug: (0, typeorm_1.In)(unique) } });
    }
    async createCatalogEntries(entries) {
        if (entries.length === 0)
            return [];
        const rows = this.facilityRepo.create(entries.map((e) => ({ title: e.title.trim(), slug: e.slug })));
        return this.facilityRepo.save(rows);
    }
    async findJunctionByHostel(hostelId) {
        return this.hostelFacilityRepo.find({ where: { hostelId } });
    }
    async saveJunction(rows) {
        return this.hostelFacilityRepo.save(rows);
    }
    createJunction(data) {
        return this.hostelFacilityRepo.create(data);
    }
    async removeJunction(rows) {
        if (rows.length === 0)
            return;
        await this.hostelFacilityRepo.remove(rows);
    }
}
exports.FacilityRepository = FacilityRepository;
