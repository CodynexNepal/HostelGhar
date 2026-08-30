// ──────────────────────────────────────────────────────────────────────────────
// FILE: fee.entity.ts
// PURPOSE: Stores monthly hostel fee bills, dues, and payment records per resident.
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
import { Resident } from '../resident/resident.entity';
import { Hostel } from '../hostel/hostel.entity';
import { FeeStatus, FeeType } from '../../enum/fee.enum';

@Entity('fees')
@Index('idx_fees_resident_status', ['residentId', 'status'])
@Index('idx_fees_hostel_month_year', ['hostelId', 'billingMonth', 'billingYear'])
@Index('idx_fees_due_date_status', ['dueDate', 'status'])
export class Fee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  residentId!: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'residentId' })
  resident!: Resident;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'enum', enum: FeeType, default: FeeType.MONTHLY_HOSTEL_FEE })
  feeType!: FeeType;

  // Monthly base fee (e.g. 10500)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 10500.0 })
  amount!: number;

  // Previous pending / due balance
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  dueAmount!: number;

  // Total payable = amount + dueAmount
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 10500.0 })
  totalPayable!: number;

  // Amount paid by student so far
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  paidAmount!: number;

  @Column({ type: 'int', nullable: false })
  billingMonth!: number; // 1 - 12

  @Column({ type: 'int', nullable: false })
  billingYear!: number; // e.g. 2026

  @Column({ type: 'date', nullable: false })
  dueDate!: string;

  @Column({ type: 'enum', enum: FeeStatus, default: FeeStatus.PENDING })
  status!: FeeStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
