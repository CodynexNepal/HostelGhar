// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-qr.entity.ts
// PURPOSE: Stores hostel payment QR codes (eSewa, Khalti, Bank Transfer)
//          shown to residents under My Payments when paying monthly fees.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Hostel } from '../hostel/hostel.entity';
import { PaymentMethod } from '../../enum/payment-qr.enum';

@Entity('payment_qrs')
@Index('idx_payment_qrs_hostel_id', ['hostelId'])
@Index('idx_payment_qrs_hostel_active', ['hostelId', 'isActive'])
@Index('idx_payment_qrs_hostel_method', ['hostelId', 'paymentMethod'])
export class PaymentQr {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: false })
  paymentMethod!: PaymentMethod;

  @Column({ type: 'varchar', length: 100, nullable: false })
  title!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  subtitle!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: false })
  accountName!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  accountIdentifier!: string;

  @Column({ type: 'varchar', length: 150, nullable: true, default: null })
  bankName!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  displayText!: string | null;

  @Column({ type: 'text', nullable: false })
  qrCodeUrl!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  qrCodePublicId!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    default: 'Displayed beneath the QR code so residents can verify or copy it',
  })
  instructions!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
