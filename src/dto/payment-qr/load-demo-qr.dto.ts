// ──────────────────────────────────────────────────────────────────────────────
// FILE: load-demo-qr.dto.ts
// PURPOSE: Validation rules for "Load Demo QRs" endpoint.
// ──────────────────────────────────────────────────────────────────────────────

import { IsOptional, IsUUID } from 'class-validator';

export class LoadDemoQrDto {
  @IsOptional()
  @IsUUID('4', { message: 'hostelId must be a valid UUID' })
  hostelId?: string;
}
