// ──────────────────────────────────────────────────────────────────────────────
// FILE: leave-request.entity.ts
// PURPOSE: Stores leave applications submitted by Residents.
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
import { LeaveType } from './leave-type.entity';
import { LeaveStatus } from '../../enum/leave.enum';

@Entity('leave_requests')
@Index('idx_leaves_resident_status_dates', ['residentId', 'status', 'startDate', 'endDate'])
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  @Index('idx_leaves_resident_id')
  residentId!: string;

  @ManyToOne(() => Resident, (resident) => resident.leaveRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'residentId' })
  resident!: Resident;

  @Column({ type: 'uuid', nullable: false })
  @Index('idx_leaves_type_id')
  leaveTypeId!: string;

  @ManyToOne(() => LeaveType, (lt) => lt.leaveRequests, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leaveTypeId' })
  leaveType!: LeaveType;

  @Column({ type: 'date', nullable: false })
  startDate!: string;

  @Column({ type: 'date', nullable: false })
  endDate!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  @Index('idx_leaves_status')
  status!: LeaveStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
