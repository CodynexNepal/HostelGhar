// ──────────────────────────────────────────────────────────────────────────────
// FILE: payment-proof.entity.ts
// PURPOSE: Stores resident-submitted payment proofs (payment screenshot/receipt)
//          tied to a fee bill. Owners/admins review them before the fee ledger
//          is marked paid.
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
import { Hostel } from '../hostel/hostel.entity';
import { Resident } from '../resident/resident.entity';
import { User } from '../user.entity';
import { PaymentProofStatus, ProofPaymentMethod } from '../../enum/payment-proof.enum';

@Entity('payment_proofs')
@Index('idx_payment_proofs_hostel_status', ['hostelId', 'status'])
@Index('idx_payment_proofs_resident', ['residentId'])
@Index('idx_payment_proofs_fee', ['feeId'])
export class PaymentProof {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ─── The fee bill this proof pays against ──────────────────────────────────
  @Column({ type: 'uuid', nullable: false })
  feeId!: string;

  @ManyToOne(() => Fee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feeId' })
  fee!: Fee;

  // ─── Denormalized hostel scope (owner/admin listings filter on this) ───────
  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  // ─── The resident who submitted the proof ──────────────────────────────────
  @Column({ type: 'uuid', nullable: false })
  residentId!: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'residentId' })
  resident!: Resident;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({
    type: 'enum',
    enum: ProofPaymentMethod,
    enumName: 'payment_proof_method_enum',
    default: ProofPaymentMethod.ESEWA,
  })
  method!: ProofPaymentMethod;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  transactionRef!: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  remarks!: string | null;

  // Screenshot/receipt image (Cloudinary URL, or a client-provided URL)
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  imageUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  imagePublicId!: string | null;

  @Column({
    type: 'enum',
    enum: PaymentProofStatus,
    enumName: 'payment_proof_status_enum',
    default: PaymentProofStatus.PENDING,
  })
  status!: PaymentProofStatus;

  @Column({ type: 'text', nullable: true, default: null })
  reviewNote!: string | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  reviewedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedBy' })
  reviewedByUser!: User | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  reviewedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
