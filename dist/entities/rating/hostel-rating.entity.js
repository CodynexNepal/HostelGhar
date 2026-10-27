"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-rating.entity.ts
// PURPOSE: Stores user/resident review ratings and feedback comments for hostels.
// ──────────────────────────────────────────────────────────────────────────────
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
exports.HostelRating = void 0;
const typeorm_1 = require("typeorm");
const hostel_entity_1 = require("../hostel/hostel.entity");
const user_entity_1 = require("../user.entity");
let HostelRating = class HostelRating {
};
exports.HostelRating = HostelRating;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], HostelRating.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], HostelRating.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, (hostel) => hostel.ratings, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], HostelRating.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelRating.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", Object)
], HostelRating.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint', nullable: false }),
    __metadata("design:type", Number)
], HostelRating.prototype, "rating", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelRating.prototype, "comment", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], HostelRating.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], HostelRating.prototype, "updatedAt", void 0);
exports.HostelRating = HostelRating = __decorate([
    (0, typeorm_1.Entity)('hostel_ratings'),
    (0, typeorm_1.Index)('idx_hostel_ratings_hostel_id', ['hostelId']),
    (0, typeorm_1.Index)('idx_hostel_ratings_user_id', ['userId']),
    (0, typeorm_1.Index)('uq_hostel_ratings_hostel_user', ['hostelId', 'userId'], {
        unique: true,
        where: '"userId" IS NOT NULL',
    })
], HostelRating);
