"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.dto.ts
// PURPOSE: Validation DTOs for weekly hostel meal schedules.
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
exports.SaveWeeklyMealsDto = exports.MealDayItemDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const meal_enum_1 = require("../../enum/meal.enum");
class MealDayItemDto {
}
exports.MealDayItemDto = MealDayItemDto;
__decorate([
    (0, class_validator_1.IsEnum)(meal_enum_1.DayOfWeek, {
        message: 'dayOfWeek must be one of: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY',
    }),
    __metadata("design:type", String)
], MealDayItemDto.prototype, "dayOfWeek", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000, { message: 'breakfastDescription cannot exceed 1000 characters' }),
    __metadata("design:type", Object)
], MealDayItemDto.prototype, "breakfastDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50, { message: 'breakfastTime cannot exceed 50 characters' }),
    __metadata("design:type", Object)
], MealDayItemDto.prototype, "breakfastTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500, { message: 'breakfastNotes cannot exceed 500 characters' }),
    __metadata("design:type", Object)
], MealDayItemDto.prototype, "breakfastNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000, { message: 'mainMealDescription cannot exceed 1000 characters' }),
    __metadata("design:type", Object)
], MealDayItemDto.prototype, "mainMealDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50, { message: 'mainMealTime cannot exceed 50 characters' }),
    __metadata("design:type", Object)
], MealDayItemDto.prototype, "mainMealTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500, { message: 'mainMealNotes cannot exceed 500 characters' }),
    __metadata("design:type", Object)
], MealDayItemDto.prototype, "mainMealNotes", void 0);
class SaveWeeklyMealsDto {
}
exports.SaveWeeklyMealsDto = SaveWeeklyMealsDto;
__decorate([
    (0, class_validator_1.IsArray)({ message: 'meals must be an array' }),
    (0, class_validator_1.ArrayMaxSize)(7, { message: 'meals cannot contain more than 7 days' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MealDayItemDto),
    __metadata("design:type", Array)
], SaveWeeklyMealsDto.prototype, "meals", void 0);
