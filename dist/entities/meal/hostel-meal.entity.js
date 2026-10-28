"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-meal.entity.ts
// PURPOSE: Stores weekly meal schedules (Breakfast & Main Meal) for a hostel.
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
exports.HostelMeal = void 0;
const typeorm_1 = require("typeorm");
const hostel_entity_1 = require("../hostel/hostel.entity");
const meal_enum_1 = require("../../enum/meal.enum");
let HostelMeal = class HostelMeal {
};
exports.HostelMeal = HostelMeal;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], HostelMeal.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], HostelMeal.prototype, "hostelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hostel_entity_1.Hostel, (hostel) => hostel.meals, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'hostelId' }),
    __metadata("design:type", hostel_entity_1.Hostel)
], HostelMeal.prototype, "hostel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: meal_enum_1.DayOfWeek, nullable: false }),
    __metadata("design:type", String)
], HostelMeal.prototype, "dayOfWeek", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelMeal.prototype, "breakfastDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelMeal.prototype, "breakfastTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelMeal.prototype, "breakfastNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelMeal.prototype, "mainMealDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelMeal.prototype, "mainMealTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, default: null }),
    __metadata("design:type", Object)
], HostelMeal.prototype, "mainMealNotes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], HostelMeal.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], HostelMeal.prototype, "updatedAt", void 0);
exports.HostelMeal = HostelMeal = __decorate([
    (0, typeorm_1.Entity)('hostel_meals'),
    (0, typeorm_1.Index)('idx_hostel_meals_hostel_id', ['hostelId']),
    (0, typeorm_1.Index)('idx_hostel_meals_hostel_day', ['hostelId', 'dayOfWeek'], { unique: true })
], HostelMeal);
