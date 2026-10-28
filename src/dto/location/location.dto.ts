// ──────────────────────────────────────────────────────────────────────────────
// FILE: location.dto.ts
// PURPOSE: Validation DTOs for hostel geographic location and sharing state.
// ──────────────────────────────────────────────────────────────────────────────

import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateHostelLocationDto {
  @IsOptional()
  @IsNumber({}, { message: 'latitude must be a valid number' })
  @Min(-90, { message: 'latitude must be >= -90' })
  @Max(90, { message: 'latitude must be <= 90' })
  latitude?: number | null;

  @IsOptional()
  @IsNumber({}, { message: 'longitude must be a valid number' })
  @Min(-180, { message: 'longitude must be >= -180' })
  @Max(180, { message: 'longitude must be <= 180' })
  longitude?: number | null;

  @IsBoolean({ message: 'isLocationShared must be a boolean' })
  isLocationShared!: boolean;
}
