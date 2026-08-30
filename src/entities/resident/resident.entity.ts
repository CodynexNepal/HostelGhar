// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident.entity.ts
// PURPOSE: Stores Resident specific profile, mapped 1:1 to User and Many:1 to Hostel.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user.entity';
import { Hostel } from '../hostel/hostel.entity';
import { LeaveRequest } from '../leave/leave-request.entity';

@Entity('residents')
@Index('idx_residents_hostel_active', ['hostelId', 'isActive'])
export class Resident {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true, nullable: false })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid', nullable: false })
  @Index('idx_residents_hostel_id')
  hostelId!: string;

  @ManyToOne(() => Hostel, (hostel) => hostel.residents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'varchar', length: 20, nullable: false })
  roomNumber!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => LeaveRequest, (lr) => lr.resident)
  leaveRequests!: LeaveRequest[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
