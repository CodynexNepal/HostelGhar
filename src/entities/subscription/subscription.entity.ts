// ──────────────────────────────────────────────────────────────────────────────
// FILE: subscription.entity.ts
// PURPOSE: Stores subscription plan assignments, status, validity, and billing records.
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
import { User } from '../user.entity';
import { Hostel } from '../hostel/hostel.entity';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from '../../enum/subscription.enum';
import { ProofPaymentMethod } from '../../enum/payment-proof.enum';

@Entity('subscriptions')
@Index('idx_subscriptions_owner_id', ['ownerId'])
@Index('idx_subscriptions_hostel_id', ['hostelId'])
@Index('idx_subscriptions_status', ['status'])
@Index('idx_subscriptions_plan', ['plan'])
@Index('idx_subscriptions_owner_active', ['ownerId', 'status'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Column({ type: 'uuid', nullable: true })
  hostelId!: string | null;

  @ManyToOne(() => Hostel, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel | null;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  plan!: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
  })
  billingCycle!: BillingCycle;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  price!: number;

  @Column({ type: 'varchar', length: 10, default: 'NPR' })
  currency!: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  startDate!: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  endDate!: Date | null;

  @Column({ type: 'boolean', default: false })
  autoRenew!: boolean;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  cancelledAt!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  paymentReference!: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  notes!: string | null;

  // ─── Payment proof (owner uploads a screenshot; admin approves) ────────────
  /**
   * How the owner paid (ESEWA | KHALTI | BANK | CASH). Reuses the existing
   * `payment_proof_method_enum` so subscription proofs and fee proofs stay
   * consistent across the platform.
   */
  @Column({
    type: 'enum',
    enum: ProofPaymentMethod,
    enumName: 'payment_proof_method_enum',
    nullable: true,
    default: null,
  })
  paymentMethod!: ProofPaymentMethod | null;

  // Screenshot/receipt of the successful payment (Cloudinary URL)
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  proofUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  proofPublicId!: string | null;

  // ─── Admin review of the request (PENDING → ACTIVE | REJECTED) ─────────────
  @Column({ type: 'uuid', nullable: true, default: null })
  reviewedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedBy' })
  reviewedByUser!: User | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  reviewedAt!: Date | null;

  @Column({ type: 'text', nullable: true, default: null })
  reviewNote!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
