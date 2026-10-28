// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.dto.ts
// PURPOSE: Validation DTOs for weekly hostel meal schedules.
// ──────────────────────────────────────────────────────────────────────────────

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DayOfWeek } from '../../enum/meal.enum';

export class MealDayItemDto {
  @IsEnum(DayOfWeek, {
    message:
      'dayOfWeek must be one of: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY',
  })
  dayOfWeek!: DayOfWeek;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'breakfastDescription cannot exceed 1000 characters' })
  breakfastDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'breakfastTime cannot exceed 50 characters' })
  breakfastTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'breakfastNotes cannot exceed 500 characters' })
  breakfastNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'mainMealDescription cannot exceed 1000 characters' })
  mainMealDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'mainMealTime cannot exceed 50 characters' })
  mainMealTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'mainMealNotes cannot exceed 500 characters' })
  mainMealNotes?: string | null;
}

export class SaveWeeklyMealsDto {
  @IsArray({ message: 'meals must be an array' })
  @ArrayMaxSize(7, { message: 'meals cannot contain more than 7 days' })
  @ValidateNested({ each: true })
  @Type(() => MealDayItemDto)
  meals!: MealDayItemDto[];
}
