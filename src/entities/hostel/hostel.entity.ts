// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel.entity.ts
// PURPOSE: Stores Hostel information created by Admin and assigned to an Owner.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../user.entity';
import { HostelType } from '../../enum/hostel.enum';
import { Resident } from '../resident/resident.entity';
import { LeaveType } from '../leave/leave-type.entity';

@Entity('hostels')
@Index('idx_hostels_owner_id', ['ownerId'])
@Index('idx_hostels_type', ['type'])
export class Hostel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120, nullable: false })
  name!: string;

  @Column({ type: 'enum', enum: HostelType, nullable: false })
  type!: HostelType;

  @Column({ type: 'uuid', nullable: true })
  ownerId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ownerId' })
  owner!: User | null;

  @Column({ type: 'uuid', nullable: false })
  @Index('idx_hostels_created_by_admin')
  createdByAdminId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdByAdminId' })
  createdByAdmin!: User;

  @OneToMany(() => Resident, (resident) => resident.hostel)
  residents!: Resident[];

  @OneToMany(() => LeaveType, (lt) => lt.hostel)
  leaveTypes!: LeaveType[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
