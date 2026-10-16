// ──────────────────────────────────────────────────────────────────────────────
// FILE: staff.entity.ts
// PURPOSE: Stores Staff members belonging to a specific Hostel (owner dashboard).
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
import { StaffRole, StaffShift, StaffStatus } from '../../enum/staff.enum';

@Entity('staff')
@Index('idx_staff_hostel', ['hostelId'])
@Index('idx_staff_hostel_status', ['hostelId', 'status'])
@Index('idx_staff_hostel_role', ['hostelId', 'role'])
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'varchar', length: 120, nullable: false })
  fullName!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  phone!: string;

  @Column({ type: 'enum', enum: StaffRole, nullable: false })
  role!: StaffRole;

  @Column({ type: 'enum', enum: StaffShift, nullable: false, default: StaffShift.DAY })
  shift!: StaffShift;

  @Column({ type: 'enum', enum: StaffStatus, nullable: false, default: StaffStatus.ACTIVE })
  status!: StaffStatus;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  email!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, default: null })
  monthlySalary!: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  emergencyContact!: string | null;

  // Cloudinary staff photo metadata
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  photoUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  photoPublicId!: string | null;

  @Column({ type: 'uuid', nullable: false })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
