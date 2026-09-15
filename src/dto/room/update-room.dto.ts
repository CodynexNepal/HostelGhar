// ──────────────────────────────────────────────────────────────────────────────
// FILE: update-room.dto.ts
// PURPOSE: Request validation DTO for Owner partially updating a Room (PATCH).
// ──────────────────────────────────────────────────────────────────────────────

import {
  IsArray,
  IsEnum,
  IsInt,
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
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return value;
};

export class UpdateRoomDto {
  @IsString()
  @MaxLength(20)
  @IsOptional()
  roomNumber?: string;

  @IsEnum(RoomType, { message: 'Type must be one of: SINGLE, DOUBLE, TRIPLE, QUAD, DORMITORY' })
  @IsOptional()
  type?: RoomType;

  @IsInt({ message: 'Capacity must be an integer' })
  @Min(1, { message: 'Capacity must be at least 1' })
  @Type(() => Number)
  @IsOptional()
  capacity?: number;

  @IsNumber({}, { message: 'Monthly rent must be a number' })
  @IsPositive({ message: 'Monthly rent must be positive' })
  @Type(() => Number)
  @IsOptional()
  monthlyRent?: number;

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

  @IsInt({ message: 'Occupied must be an integer' })
  @Min(0, { message: 'Occupied cannot be negative' })
  @Type(() => Number)
  @IsOptional()
  occupied?: number;

  // Link an existing room to a hostel (rooms can be created unlinked).
  // Empty string / null clears nothing — field is simply ignored unless a UUID.
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsUUID('4', { message: 'Hostel ID must be a valid UUID' })
  @IsOptional()
  hostelId?: string;
}
