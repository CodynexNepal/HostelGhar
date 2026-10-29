"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel.entity.ts
// PURPOSE: Stores Hostel information created by Admin and assigned to an Owner.
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
exports.Hostel = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../user.entity");
const hostel_enum_1 = require("../../enum/hostel.enum");
const resident_entity_1 = require("../resident/resident.entity");
const leave_type_entity_1 = require("../leave/leave-type.entity");
const hostel_facility_entity_1 = require("../facility/hostel-facility.entity");
const payment_qr_entity_1 = require("../payment-qr/payment-qr.entity");
const subscription_entity_1 = require("../subscription/subscription.entity");
const staff_entity_1 = require("../staff/staff.entity");
const hostel_rating_entity_1 = require("../rating/hostel-rating.entity");
const hostel_meal_entity_1 = require("../meal/hostel-meal.entity");
const hostel_daily_meal_entity_1 = require("../meal/hostel-daily-meal.entity");
let Hostel = class Hostel {
};
exports.Hostel = Hostel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Hostel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, nullable: false }),
    __metadata("design:type", String)
], Hostel.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: hostel_enum_1.HostelType, nullable: false }),
    __metadata("design:type", String)
], Hostel.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, nullable: true, default: null }),
    __metadata("design:type", Object)
], Hostel.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, default: null }),
    __metadata("design:type", Object)
], Hostel.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true, default: null }),
    __metadata("design:type", Object)
], Hostel.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, default: null }),
    __metadata("design:type", Object)
], Hostel.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, default: null }),
    __metadata("design:type", Object)
], Hostel.prototype, "logoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, default: null }),
    __metadata("design:type", Object)
], Hostel.prototype, "logoPublicId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', nullable: false, default: true }),
    __metadata("design:type", Boolean)
], Hostel.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true, default: null }),
    __metadata("design:type", Object)
], Hostel.prototype, "suspendedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, default: null }),
    __metadata("design:type", Object)
], Hostel.prototype, "suspendReason", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'numeric',
        precision: 10,
        scale: 7,
        nullable: true,
        default: null,
        transformer: {
            to: (value) => value,
            from: (value) => (value != null ? parseFloat(value) : null),
        },
    }),
    __metadata("design:type", Object)
], Hostel.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'numeric',
        precision: 10,
        scale: 7,
        nullable: true,
        default: null,
        transformer: {
            to: (value) => value,
            from: (value) => (value != null ? parseFloat(value) : null),
        },
    }),
    __metadata("design:type", Object)
], Hostel.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', nullable: false, default: false }),
    (0, typeorm_1.Index)('idx_hostels_is_location_shared'),
    __metadata("design:type", Boolean)
], Hostel.prototype, "isLocationShared", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true, default: null }),
    __metadata("design:type", Object)
], Hostel.prototype, "locationUpdatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Hostel.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'ownerId' }),
    __metadata("design:type", Object)
], Hostel.prototype, "owner", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    (0, typeorm_1.Index)('idx_hostels_created_by_admin'),
    __metadata("design:type", String)
], Hostel.prototype, "createdByAdminId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'RESTRICT' }),
    (0, typeorm_1.JoinColumn)({ name: 'createdByAdminId' }),
    __metadata("design:type", user_entity_1.User)
], Hostel.prototype, "createdByAdmin", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => resident_entity_1.Resident, (resident) => resident.hostel),
    __metadata("design:type", Array)
], Hostel.prototype, "residents", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => leave_type_entity_1.LeaveType, (lt) => lt.hostel),
    __metadata("design:type", Array)
], Hostel.prototype, "leaveTypes", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => hostel_facility_entity_1.HostelFacility, (hf) => hf.hostel),
    __metadata("design:type", Array)
], Hostel.prototype, "hostelFacilities", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => payment_qr_entity_1.PaymentQr, (qr) => qr.hostel),
    __metadata("design:type", Array)
], Hostel.prototype, "paymentQrs", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => subscription_entity_1.Subscription, (sub) => sub.hostel),
    __metadata("design:type", Array)
], Hostel.prototype, "subscriptions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => staff_entity_1.Staff, (staff) => staff.hostel),
    __metadata("design:type", Array)
], Hostel.prototype, "staffMembers", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => hostel_rating_entity_1.HostelRating, (rating) => rating.hostel),
    __metadata("design:type", Array)
], Hostel.prototype, "ratings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => hostel_meal_entity_1.HostelMeal, (meal) => meal.hostel),
    __metadata("design:type", Array)
], Hostel.prototype, "meals", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => hostel_daily_meal_entity_1.HostelDailyMeal, (m) => m.hostel),
    __metadata("design:type", Array)
], Hostel.prototype, "dailyMeals", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Hostel.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Hostel.prototype, "updatedAt", void 0);
exports.Hostel = Hostel = __decorate([
    (0, typeorm_1.Entity)('hostels'),
    (0, typeorm_1.Index)('idx_hostels_owner_id', ['ownerId']),
    (0, typeorm_1.Index)('idx_hostels_type', ['type'])
], Hostel);
