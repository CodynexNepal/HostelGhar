// FILE: logout.dto.ts
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @IsOptional()
  @IsBoolean({ message: 'logoutAll must be a boolean' })
  logoutAll?: boolean;

  @IsOptional()
  @IsString({ message: 'refreshToken must be a string' })
  refreshToken?: string;
}
