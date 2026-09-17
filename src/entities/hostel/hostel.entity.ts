// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel.entity.ts
// PURPOSE: Stores Hostel information created by Admin and assigned to an Owner.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user.entity';
import { HostelType } from '../../enum/hostel.enum';
import { Resident } from '../resident/resident.entity';
import { LeaveType } from '../leave/leave-type.entity';
import { HostelFacility } from '../facility/hostel-facility.entity';

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

  @Column({ type: 'varchar', length: 120, nullable: true, default: null })
  city!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  address!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  email!: string | null;

  // Cloudinary hostel logo metadata
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  logoUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  logoPublicId!: string | null;

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

  @OneToMany(() => HostelFacility, (hf) => hf.hostel)
  hostelFacilities!: HostelFacility[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
