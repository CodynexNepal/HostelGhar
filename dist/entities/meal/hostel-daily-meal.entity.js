"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-daily-meal.entity.ts
// PURPOSE: Stores daily meal schedule slots (दैनिक भोजन तालिका) for a hostel.
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
exports.HostelDailyMeal = void 0;
const typeorm_1 = require("typeorm");
const hostel_entity_1 = require("../hostel/hostel.entity");
let HostelDailyMeal = class HostelDailyMeal {
};
exports.HostelDailyMeal = HostelDailyMeal;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], HostelDailyMeal.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], HostelDailyMeal.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, (hostel) => hostel.dailyMeals, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], HostelDailyMeal.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'dayOfWeek', type: 'varchar', length: 20, default: 'ALL', nullable: false }),
    __metadata("design:type", String)
], HostelDailyMeal.prototype, "dayOfWeek", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], HostelDailyMeal.prototype, "mealName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelDailyMeal.prototype, "mealNameEn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], HostelDailyMeal.prototype, "time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelDailyMeal.prototype, "menuDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], HostelDailyMeal.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], HostelDailyMeal.prototype, "orderIndex", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], HostelDailyMeal.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], HostelDailyMeal.prototype, "updatedAt", void 0);
exports.HostelDailyMeal = HostelDailyMeal = __decorate([
    (0, typeorm_1.Entity)('hostel_daily_meals'),
    (0, typeorm_1.Index)('idx_hostel_daily_meals_hostel_id', ['hostelId']),
    (0, typeorm_1.Index)('idx_hostel_daily_meals_hostel_order', ['hostelId', 'orderIndex']),
    (0, typeorm_1.Index)('idx_hostel_daily_meals_hostel_day_order', ['hostelId', 'dayOfWeek', 'orderIndex'])
], HostelDailyMeal);
