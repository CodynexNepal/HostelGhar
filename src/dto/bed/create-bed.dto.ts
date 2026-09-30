import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { BedStatus } from '../../enum/bed.enum';

export class CreateBedDto {
  @IsUUID('4', { message: 'Hostel ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Hostel ID is required' })
  hostelId!: string;

  @IsString({ message: 'Room number must be a string' })
  @IsNotEmpty({ message: 'Room number is required' })
  @MaxLength(20, { message: 'Room number cannot exceed 20 characters' })
  roomNumber!: string;

  @IsString({ message: 'Bed number must be a string' })
  @IsNotEmpty({ message: 'Bed number is required' })
  @MaxLength(20, { message: 'Bed number cannot exceed 20 characters' })
  bedNumber!: string;

  @IsOptional()
  @IsEnum(BedStatus, {
    message: 'Status must be one of: AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE',
  })
  status?: BedStatus;

  @IsOptional()
  @IsNumber({}, { message: 'Rent amount must be a number' })
  @Min(0, { message: 'Rent amount cannot be negative' })
  @Type(() => Number)
  rentAmount?: number;
}
