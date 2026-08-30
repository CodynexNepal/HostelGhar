// ──────────────────────────────────────────────────────────────────────────────
// FILE: leave-type.entity.ts
// PURPOSE: Stores leave categories/policies configured by an Owner for a Hostel.
//          Examples: Sick Leave, Night Out, Casual Leave, Home Visit.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  Unique,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Hostel } from '../hostel/hostel.entity';
import { LeaveRequest } from './leave-request.entity';

@Entity('leave_types')
@Unique('uq_hostel_leave_type', ['hostelId', 'name'])
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  @Index('idx_leave_types_hostel_id')
  hostelId!: string;

  @ManyToOne(() => Hostel, (hostel) => hostel.leaveTypes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'varchar', length: 50, nullable: false })
  name!: string;

  @Column({ type: 'int', default: 7 })
  maxDays!: number;

  @Column({ type: 'boolean', default: false })
  requiresParentApproval!: boolean;

  @OneToMany(() => LeaveRequest, (lr) => lr.leaveType)
  leaveRequests!: LeaveRequest[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
