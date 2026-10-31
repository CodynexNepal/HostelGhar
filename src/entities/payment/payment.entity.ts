// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment.entity.ts
// PURPOSE: Stores successful and processed payment transactions (cash, digital,
//          partial, full) associated with monthly fees/invoices.
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
import { Fee } from '../fee/fee.entity';
import { Resident } from '../resident/resident.entity';
import { Hostel } from '../hostel/hostel.entity';
import { User } from '../user.entity';
import { PaymentMethod, PaymentStatus } from '../../enum/payment.enum';

@Entity('payments')
@Index('idx_payments_invoice', ['invoiceId'])
@Index('idx_payments_resident', ['residentId'])
@Index('idx_payments_hostel_paid_at', ['hostelId', 'paidAt'])
@Index('idx_payments_transaction_ref', ['transactionReference'])
@Index('idx_payments_idempotency_key', ['idempotencyKey'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  invoiceId!: string;

  @ManyToOne(() => Fee, (fee) => fee.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  fee!: Fee;

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

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method_enum',
    default: PaymentMethod.CASH,
  })
  paymentMethod!: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status_enum',
    default: PaymentStatus.SUCCESS,
  })
  paymentStatus!: PaymentStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionReference!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true, unique: true })
  idempotencyKey!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  receiptNumber!: string | null;

  @Column({ type: 'uuid', nullable: true })
  receivedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'receivedBy' })
  receivedByUser!: User | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  paidAt!: Date;

  @Column({ type: 'text', nullable: true })
  remarks!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
