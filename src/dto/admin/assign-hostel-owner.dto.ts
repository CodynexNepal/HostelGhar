import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignHostelOwnerDto {
  @IsUUID('4', { message: 'Owner ID must be a valid UUID v4' })
  @IsNotEmpty({ message: 'Owner ID is required' })
  ownerId!: string;
}
