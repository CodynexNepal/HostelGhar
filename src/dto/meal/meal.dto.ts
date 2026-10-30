// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.dto.ts
// PURPOSE: Validation DTOs for weekly hostel meal schedules.
// ──────────────────────────────────────────────────────────────────────────────

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DayOfWeek } from '../../enum/meal.enum';

export class MealDayItemDto {
  // Weekly meal day of week
  @Transform(({ value, obj }) => {
    const raw = value ?? obj?.day;
    if (typeof raw === 'string') {
      return raw.toUpperCase().trim();
    }
    return raw;
  })
  @ValidateIf((o) => !o.mealName || o.dayOfWeek !== undefined)
  @IsEnum(DayOfWeek, {
    message:
      'dayOfWeek must be one of: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY',
  })
  @IsOptional()
  dayOfWeek?: DayOfWeek;

  @IsOptional()
  @IsString()
  day?: string;

  @IsOptional()
  @IsString()
  id?: string | null;

  @IsOptional()
  @IsString()
  hostelId?: string | null;

  @IsOptional()
  @IsString()
  hostel_id?: string | null;

  // Daily meal fields (if frontend passes daily meals to /meals)
  @IsOptional()
  @IsString({ message: 'mealName must be a string' })
  @MaxLength(100)
  mealName?: string;

  @IsOptional()
  @IsString({ message: 'mealNameEn must be a string' })
  @MaxLength(100)
  mealNameEn?: string | null;

  @IsOptional()
  @IsString({ message: 'time must be a string' })
  @MaxLength(100)
  time?: string;

  @IsOptional()
  @IsString({ message: 'menuDescription must be a string' })
  @MaxLength(1000)
  menuDescription?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  orderIndex?: number;

  // Weekly meal fields
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(1000, { message: 'breakfastDescription cannot exceed 1000 characters' })
  @IsOptional()
  breakfastDescription?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(50, { message: 'breakfastTime cannot exceed 50 characters' })
  @IsOptional()
  breakfastTime?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(500, { message: 'breakfastNotes cannot exceed 500 characters' })
  @IsOptional()
  breakfastNotes?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(1000, { message: 'mainMealDescription cannot exceed 1000 characters' })
  @IsOptional()
  mainMealDescription?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(50, { message: 'mainMealTime cannot exceed 50 characters' })
  @IsOptional()
  mainMealTime?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(500, { message: 'mainMealNotes cannot exceed 500 characters' })
  @IsOptional()
  mainMealNotes?: string | null;

  @IsOptional()
  createdAt?: unknown;

  @IsOptional()
  updatedAt?: unknown;

  @IsOptional()
  created_at?: unknown;

  @IsOptional()
  updated_at?: unknown;

  @IsOptional()
  isConfigured?: boolean;
}

export class SaveWeeklyMealsDto {
  @IsOptional()
  @IsString()
  dayOfWeek?: string;

  @IsArray({ message: 'meals must be an array' })
  @ArrayMaxSize(20, { message: 'meals cannot contain more than 20 items' })
  @ValidateNested({ each: true })
  @Type(() => MealDayItemDto)
  meals!: MealDayItemDto[];
}
