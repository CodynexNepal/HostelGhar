// ──────────────────────────────────────────────────────────────────────────────
// FILE: daily-meal.dto.ts
// PURPOSE: Validation DTOs for Daily Meal Schedule (दैनिक भोजन तालिका).
// ──────────────────────────────────────────────────────────────────────────────

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DailyMealItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString({ message: 'dayOfWeek must be a string' })
  @MaxLength(20, { message: 'dayOfWeek cannot exceed 20 characters' })
  dayOfWeek?: string;

  @IsNotEmpty({ message: 'खानाको प्रकार (mealName) is required' })
  @IsString({ message: 'mealName must be a string' })
  @MinLength(2, { message: 'mealName must be at least 2 characters' })
  @MaxLength(100, { message: 'mealName cannot exceed 100 characters' })
  mealName!: string;

  @IsOptional()
  @IsString({ message: 'mealNameEn must be a string' })
  @MaxLength(100, { message: 'mealNameEn cannot exceed 100 characters' })
  mealNameEn?: string | null;

  @IsNotEmpty({ message: 'समय (time) is required' })
  @IsString({ message: 'time must be a string' })
  @MinLength(2, { message: 'time must be at least 2 characters' })
  @MaxLength(100, { message: 'time cannot exceed 100 characters' })
  time!: string;

  @IsOptional()
  @IsString({ message: 'menuDescription must be a string' })
  @MaxLength(1000, { message: 'menuDescription cannot exceed 1000 characters' })
  menuDescription?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsInt({ message: 'orderIndex must be an integer' })
  orderIndex?: number;
}

export class CreateDailyMealDto {
  @IsOptional()
  @IsString({ message: 'dayOfWeek must be a string' })
  @MaxLength(20, { message: 'dayOfWeek cannot exceed 20 characters' })
  dayOfWeek?: string;

  @IsNotEmpty({ message: 'खानाको प्रकार (mealName) is required' })
  @IsString({ message: 'mealName must be a string' })
  @MinLength(2, { message: 'mealName must be at least 2 characters' })
  @MaxLength(100, { message: 'mealName cannot exceed 100 characters' })
  mealName!: string;

  @IsOptional()
  @IsString({ message: 'mealNameEn must be a string' })
  @MaxLength(100, { message: 'mealNameEn cannot exceed 100 characters' })
  mealNameEn?: string | null;

  @IsNotEmpty({ message: 'समय (time) is required' })
  @IsString({ message: 'time must be a string' })
  @MinLength(2, { message: 'time must be at least 2 characters' })
  @MaxLength(100, { message: 'time cannot exceed 100 characters' })
  time!: string;

  @IsOptional()
  @IsString({ message: 'menuDescription must be a string' })
  @MaxLength(1000, { message: 'menuDescription cannot exceed 1000 characters' })
  menuDescription?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsInt({ message: 'orderIndex must be an integer' })
  orderIndex?: number;
}

export class UpdateDailyMealDto {
  @IsOptional()
  @IsString({ message: 'dayOfWeek must be a string' })
  @MaxLength(20, { message: 'dayOfWeek cannot exceed 20 characters' })
  dayOfWeek?: string;

  @IsOptional()
  @IsString({ message: 'mealName must be a string' })
  @MinLength(2, { message: 'mealName must be at least 2 characters' })
  @MaxLength(100, { message: 'mealName cannot exceed 100 characters' })
  mealName?: string;

  @IsOptional()
  @IsString({ message: 'mealNameEn must be a string' })
  @MaxLength(100, { message: 'mealNameEn cannot exceed 100 characters' })
  mealNameEn?: string | null;

  @IsOptional()
  @IsString({ message: 'time must be a string' })
  @MinLength(2, { message: 'time must be at least 2 characters' })
  @MaxLength(100, { message: 'time cannot exceed 100 characters' })
  time?: string;

  @IsOptional()
  @IsString({ message: 'menuDescription must be a string' })
  @MaxLength(1000, { message: 'menuDescription cannot exceed 1000 characters' })
  menuDescription?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsInt({ message: 'orderIndex must be an integer' })
  orderIndex?: number;
}

export class SaveDailyMealsDto {
  @IsOptional()
  @IsString({ message: 'dayOfWeek must be a string' })
  @MaxLength(20, { message: 'dayOfWeek cannot exceed 20 characters' })
  dayOfWeek?: string;

  @IsArray({ message: 'meals must be an array' })
  @ArrayMaxSize(20, { message: 'meals cannot contain more than 20 daily items' })
  @ValidateNested({ each: true })
  @Type(() => DailyMealItemDto)
  meals!: DailyMealItemDto[];
}
