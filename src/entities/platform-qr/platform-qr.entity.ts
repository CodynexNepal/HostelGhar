// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.entity.ts
// PURPOSE: Stores Hostel Ghar PLATFORM payment QRs — the official checkout
//          accounts (eSewa / Khalti / Bank) that hostel owners scan on the
//          Subscription page when they pay for a plan. One row per method.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlatformQrMethod } from '../../enum/platform-qr.enum';

@Entity('platform_qrs')
@Unique('UQ_platform_qrs_method', ['method'])
export class PlatformQr {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: PlatformQrMethod,
    enumName: 'platform_qr_method_enum',
    nullable: false,
  })
  method!: PlatformQrMethod;

  /** Public QR image URL (Cloudinary) that owners scan to pay. */
  @Column({ type: 'text', nullable: false })
  qrImageUrl!: string;

  /** Cloudinary public_id for the uploaded QR image (for cleanup on replace/delete). */
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  qrImagePublicId!: string | null;

  /** Human account line shown under the QR (e.g. "eSewa ID: 98XXXXXXXX • Hostel Ghar"). */
  @Column({ type: 'varchar', length: 255, nullable: false, default: '' })
  label!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
