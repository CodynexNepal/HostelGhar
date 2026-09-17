// ──────────────────────────────────────────────────────────────────────────────
// FILE: facility.dto.ts
// PURPOSE: Validation DTOs for hostel facility endpoints.
//          Frontend sends: { id?, title, description?, tag? }.
//          `id` is the FRONTEND client key (e.g. "security-mu5ofghs") —
//          mapped to HostelFacility.clientKey, never to a DB primary key.
// ──────────────────────────────────────────────────────────────────────────────

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FacilityTag } from '../../enum/facility.enum';

export class UpsertFacilityItemDto {
  // Frontend client key, e.g. "security-mu5ofghs". Optional on create.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  id?: string;

  @IsString()
  @IsNotEmpty({ message: 'Facility title is required' })
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(FacilityTag, { message: 'Tag must be one of: Included, Excluded, Extra Charge' })
  tag?: FacilityTag;
}

export class SyncHostelFacilitiesDto {
  @IsArray({ message: 'facilities must be an array' })
  @ArrayMaxSize(200, { message: 'Cannot sync more than 200 facilities at once' })
  @ValidateNested({ each: true })
  @Type(() => UpsertFacilityItemDto)
  facilities!: UpsertFacilityItemDto[];
}
