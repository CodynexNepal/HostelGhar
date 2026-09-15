// ──────────────────────────────────────────────────────────────────────────────
// FILE: create-room.dto.ts
// PURPOSE: Request validation DTO for Owner creating a Room.
// ──────────────────────────────────────────────────────────────────────────────

import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { RoomStatus, RoomType } from '../../enum/room.enum';

const parseAmenities = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Comma-separated fallback: "Wifi, Hot Water" -> ["Wifi", "Hot Water"]
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return value;
};

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'Room number is required' })
  @MaxLength(20)
  roomNumber!: string;

  @IsEnum(RoomType, { message: 'Type must be one of: SINGLE, DOUBLE, TRIPLE, QUAD, DORMITORY' })
  type!: RoomType;

  @IsInt({ message: 'Capacity must be an integer' })
  @Min(1, { message: 'Capacity must be at least 1' })
  @Type(() => Number)
  capacity!: number;

  @IsNumber({}, { message: 'Monthly rent must be a number' })
  @IsPositive({ message: 'Monthly rent must be positive' })
  @Type(() => Number)
  monthlyRent!: number;

  @IsArray({ message: 'Amenities must be an array of strings' })
  @IsString({ each: true, message: 'Each amenity must be a string' })
  @Transform(parseAmenities)
  @IsOptional()
  amenities?: string[];

  @IsInt({ message: 'Floor must be an integer' })
  @Min(0, { message: 'Floor cannot be negative' })
  @Type(() => Number)
  @IsOptional()
  floor?: number;

  @IsEnum(RoomStatus, {
    message: 'Status must be one of: AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE',
  })
  @IsOptional()
  status?: RoomStatus;

  // Empty string from multipart forms must not fail @IsUUID — treat as absent.
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsUUID('4', { message: 'Hostel ID must be a valid UUID' })
  hostelId?: string;
}
