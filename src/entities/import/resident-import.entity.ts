// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident-import.entity.ts
// PURPOSE: Persists every bulk CSV resident-import as a background job record
//          so the "Import Residents" UI can render import history, progress,
//          per-row errors and plan-limit usage.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Hostel } from '../hostel/hostel.entity';
import { User } from '../user.entity';

export enum ResidentImportStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS',
  FAILED = 'FAILED',
}

@Entity('resident_imports')
@Index('idx_resident_imports_hostel_created', ['hostelId', 'createdAt'])
@Index('idx_resident_imports_owner_created', ['requestedBy', 'createdAt'])
@Index('idx_resident_imports_status', ['status'])
export class ResidentImport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'uuid', nullable: false })
  requestedBy!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requestedBy' })
  requestedByUser!: User | null;

  @Column({ type: 'varchar', length: 255, nullable: false })
  fileName!: string;

  @Column({
    type: 'enum',
    enum: ResidentImportStatus,
    default: ResidentImportStatus.QUEUED,
  })
  status!: ResidentImportStatus;

  @Column({ type: 'int', default: 0 })
  totalRows!: number;

  @Column({ type: 'int', default: 0 })
  validRows!: number;

  @Column({ type: 'int', default: 0 })
  successCount!: number;

  @Column({ type: 'int', default: 0 })
  failedCount!: number;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  idempotencyKey!: string | null;

  // Stored as JSONB so history detail can render per-row errors without
  // a second table. Capped by the service (first 100 errors).
  @Column({ type: 'jsonb', nullable: true, default: null })
  rowErrors!: Array<{ row: number; email?: string | undefined; message: string }> | null;

  @Column({ type: 'text', nullable: true, default: null })
  failureReason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  completedAt!: Date | null;
}
