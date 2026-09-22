import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOwnerDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail({}, { message: 'A valid owner email is required' })
  @IsNotEmpty({ message: 'Owner email is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone is required' })
  @MaxLength(20)
  phone!: string;

  // The actual image is handled by Multer as req.file. This optional DTO
  // field allows multipart clients to include the image field without it
  // being rejected by whitelist validation after stripFileFields runs.
  @IsOptional()
  @IsString()
  image?: string;
}
