"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: daily-meal.dto.ts
// PURPOSE: Validation DTOs for Daily Meal Schedule (दैनिक भोजन तालिका).
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
exports.SaveDailyMealsDto = exports.UpdateDailyMealDto = exports.CreateDailyMealDto = exports.DailyMealItemDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class DailyMealItemDto {
}
exports.DailyMealItemDto = DailyMealItemDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DailyMealItemDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'dayOfWeek must be a string' }),
    (0, class_validator_1.MaxLength)(20, { message: 'dayOfWeek cannot exceed 20 characters' }),
    __metadata("design:type", String)
], DailyMealItemDto.prototype, "dayOfWeek", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'खानाको प्रकार (mealName) is required' }),
    (0, class_validator_1.IsString)({ message: 'mealName must be a string' }),
    (0, class_validator_1.MinLength)(2, { message: 'mealName must be at least 2 characters' }),
    (0, class_validator_1.MaxLength)(100, { message: 'mealName cannot exceed 100 characters' }),
    __metadata("design:type", String)
], DailyMealItemDto.prototype, "mealName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'mealNameEn must be a string' }),
    (0, class_validator_1.MaxLength)(100, { message: 'mealNameEn cannot exceed 100 characters' }),
    __metadata("design:type", Object)
], DailyMealItemDto.prototype, "mealNameEn", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'समय (time) is required' }),
    (0, class_validator_1.IsString)({ message: 'time must be a string' }),
    (0, class_validator_1.MinLength)(2, { message: 'time must be at least 2 characters' }),
    (0, class_validator_1.MaxLength)(100, { message: 'time cannot exceed 100 characters' }),
    __metadata("design:type", String)
], DailyMealItemDto.prototype, "time", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'menuDescription must be a string' }),
    (0, class_validator_1.MaxLength)(1000, { message: 'menuDescription cannot exceed 1000 characters' }),
    __metadata("design:type", Object)
], DailyMealItemDto.prototype, "menuDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'isActive must be a boolean' }),
    __metadata("design:type", Boolean)
], DailyMealItemDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)({ message: 'orderIndex must be an integer' }),
    __metadata("design:type", Number)
], DailyMealItemDto.prototype, "orderIndex", void 0);
class CreateDailyMealDto {
}
exports.CreateDailyMealDto = CreateDailyMealDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'dayOfWeek must be a string' }),
    (0, class_validator_1.MaxLength)(20, { message: 'dayOfWeek cannot exceed 20 characters' }),
    __metadata("design:type", String)
], CreateDailyMealDto.prototype, "dayOfWeek", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'खानाको प्रकार (mealName) is required' }),
    (0, class_validator_1.IsString)({ message: 'mealName must be a string' }),
    (0, class_validator_1.MinLength)(2, { message: 'mealName must be at least 2 characters' }),
    (0, class_validator_1.MaxLength)(100, { message: 'mealName cannot exceed 100 characters' }),
    __metadata("design:type", String)
], CreateDailyMealDto.prototype, "mealName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'mealNameEn must be a string' }),
    (0, class_validator_1.MaxLength)(100, { message: 'mealNameEn cannot exceed 100 characters' }),
    __metadata("design:type", Object)
], CreateDailyMealDto.prototype, "mealNameEn", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'समय (time) is required' }),
    (0, class_validator_1.IsString)({ message: 'time must be a string' }),
    (0, class_validator_1.MinLength)(2, { message: 'time must be at least 2 characters' }),
    (0, class_validator_1.MaxLength)(100, { message: 'time cannot exceed 100 characters' }),
    __metadata("design:type", String)
], CreateDailyMealDto.prototype, "time", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'menuDescription must be a string' }),
    (0, class_validator_1.MaxLength)(1000, { message: 'menuDescription cannot exceed 1000 characters' }),
    __metadata("design:type", Object)
], CreateDailyMealDto.prototype, "menuDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'isActive must be a boolean' }),
    __metadata("design:type", Boolean)
], CreateDailyMealDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)({ message: 'orderIndex must be an integer' }),
    __metadata("design:type", Number)
], CreateDailyMealDto.prototype, "orderIndex", void 0);
class UpdateDailyMealDto {
}
exports.UpdateDailyMealDto = UpdateDailyMealDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'dayOfWeek must be a string' }),
    (0, class_validator_1.MaxLength)(20, { message: 'dayOfWeek cannot exceed 20 characters' }),
    __metadata("design:type", String)
], UpdateDailyMealDto.prototype, "dayOfWeek", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'mealName must be a string' }),
    (0, class_validator_1.MinLength)(2, { message: 'mealName must be at least 2 characters' }),
    (0, class_validator_1.MaxLength)(100, { message: 'mealName cannot exceed 100 characters' }),
    __metadata("design:type", String)
], UpdateDailyMealDto.prototype, "mealName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'mealNameEn must be a string' }),
    (0, class_validator_1.MaxLength)(100, { message: 'mealNameEn cannot exceed 100 characters' }),
    __metadata("design:type", Object)
], UpdateDailyMealDto.prototype, "mealNameEn", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'time must be a string' }),
    (0, class_validator_1.MinLength)(2, { message: 'time must be at least 2 characters' }),
    (0, class_validator_1.MaxLength)(100, { message: 'time cannot exceed 100 characters' }),
    __metadata("design:type", String)
], UpdateDailyMealDto.prototype, "time", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'menuDescription must be a string' }),
    (0, class_validator_1.MaxLength)(1000, { message: 'menuDescription cannot exceed 1000 characters' }),
    __metadata("design:type", Object)
], UpdateDailyMealDto.prototype, "menuDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'isActive must be a boolean' }),
    __metadata("design:type", Boolean)
], UpdateDailyMealDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)({ message: 'orderIndex must be an integer' }),
    __metadata("design:type", Number)
], UpdateDailyMealDto.prototype, "orderIndex", void 0);
class SaveDailyMealsDto {
}
exports.SaveDailyMealsDto = SaveDailyMealsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'dayOfWeek must be a string' }),
    (0, class_validator_1.MaxLength)(20, { message: 'dayOfWeek cannot exceed 20 characters' }),
    __metadata("design:type", String)
], SaveDailyMealsDto.prototype, "dayOfWeek", void 0);
__decorate([
    (0, class_validator_1.IsArray)({ message: 'meals must be an array' }),
    (0, class_validator_1.ArrayMaxSize)(20, { message: 'meals cannot contain more than 20 daily items' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DailyMealItemDto),
    __metadata("design:type", Array)
], SaveDailyMealsDto.prototype, "meals", void 0);
