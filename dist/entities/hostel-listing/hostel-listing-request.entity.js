"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostelListingRequest = exports.ListingRequestStatus = void 0;
const typeorm_1 = require("typeorm");
var ListingRequestStatus;
(function (ListingRequestStatus) {
    ListingRequestStatus["PENDING"] = "PENDING";
    ListingRequestStatus["REVIEWING"] = "REVIEWING";
    ListingRequestStatus["APPROVED"] = "APPROVED";
    ListingRequestStatus["REJECTED"] = "REJECTED";
})(ListingRequestStatus || (exports.ListingRequestStatus = ListingRequestStatus = {}));
let HostelListingRequest = class HostelListingRequest {
};
exports.HostelListingRequest = HostelListingRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], HostelListingRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], HostelListingRequest.prototype, "hostelName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'coed' }),
    __metadata("design:type", String)
], HostelListingRequest.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], HostelListingRequest.prototype, "totalBeds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], HostelListingRequest.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], HostelListingRequest.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, nullable: true }),
    __metadata("design:type", Object)
], HostelListingRequest.prototype, "area", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], HostelListingRequest.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], HostelListingRequest.prototype, "priceFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], HostelListingRequest.prototype, "negotiable", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], HostelListingRequest.prototype, "amenities", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], HostelListingRequest.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], HostelListingRequest.prototype, "rules", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], HostelListingRequest.prototype, "photos", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150 }),
    __metadata("design:type", String)
], HostelListingRequest.prototype, "ownerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], HostelListingRequest.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ListingRequestStatus,
        default: ListingRequestStatus.PENDING,
    }),
    __metadata("design:type", String)
], HostelListingRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], HostelListingRequest.prototype, "adminNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], HostelListingRequest.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], HostelListingRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], HostelListingRequest.prototype, "updatedAt", void 0);
exports.HostelListingRequest = HostelListingRequest = __decorate([
    (0, typeorm_1.Entity)('hostel_listing_requests'),
    (0, typeorm_1.Index)('idx_listing_requests_email', ['email']),
    (0, typeorm_1.Index)('idx_listing_requests_phone', ['phone']),
    (0, typeorm_1.Index)('idx_listing_requests_status', ['status'])
], HostelListingRequest);
