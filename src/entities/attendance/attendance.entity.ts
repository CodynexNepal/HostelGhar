// ──────────────────────────────────────────────────────────────────────────────
// FILE: attendance.entity.ts
// PURPOSE: Daily resident attendance records (one row per resident per day).
//          Residents self check-in; owners/admins view per hostel.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Hostel } from '../hostel/hostel.entity';
import { Resident } from '../resident/resident.entity';
import { User } from '../user.entity';
import { AttendanceStatus } from '../../enum/attendance.enum';

@Entity('attendances')
@Unique('uq_attendances_resident_date', ['residentId', 'date'])
@Index('idx_attendances_hostel_date', ['hostelId', 'date'])
@Index('idx_attendances_resident_date', ['residentId', 'date'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'uuid', nullable: false })
  residentId!: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'residentId' })
  resident!: Resident;

  // Attendance day (YYYY-MM-DD, Nepal date). Unique per resident — enforced
  // by uq_attendances_resident_date so double check-ins race safely.
  @Column({ type: 'date', nullable: false })
  date!: string;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    nullable: false,
    default: AttendanceStatus.PRESENT,
  })
  status!: AttendanceStatus;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  checkInAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  checkOutAt!: Date | null;

  @Column({
    type: 'double precision',
    nullable: true,
    default: null,
    transformer: {
      to: (value?: number | null) => value,
      from: (value?: number | string | null) => (value != null ? parseFloat(String(value)) : null),
    },
  })
  checkInLatitude!: number | null;

  @Column({
    type: 'double precision',
    nullable: true,
    default: null,
    transformer: {
      to: (value?: number | null) => value,
      from: (value?: number | string | null) => (value != null ? parseFloat(String(value)) : null),
    },
  })
  checkInLongitude!: number | null;

  @Column({
    type: 'double precision',
    nullable: true,
    default: null,
    transformer: {
      to: (value?: number | null) => value,
      from: (value?: number | string | null) => (value != null ? parseFloat(String(value)) : null),
    },
  })
  checkOutLatitude!: number | null;

  @Column({
    type: 'double precision',
    nullable: true,
    default: null,
    transformer: {
      to: (value?: number | null) => value,
      from: (value?: number | string | null) => (value != null ? parseFloat(String(value)) : null),
    },
  })
  checkOutLongitude!: number | null;

  @Column({ type: 'varchar', length: 45, nullable: true, default: null })
  checkInIp!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true, default: null })
  checkOutIp!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    default: null,
    transformer: {
      to: (value?: number | null) => value,
      from: (value?: string | null) => (value != null ? parseFloat(value) : null),
    },
  })
  checkInDistanceMeters!: number | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    default: null,
    transformer: {
      to: (value?: number | null) => value,
      from: (value?: string | null) => (value != null ? parseFloat(value) : null),
    },
  })
  checkOutDistanceMeters!: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  note!: string | null;

  // User who recorded the row (resident self check-in, or owner/warden mark).
  @Column({ type: 'uuid', nullable: true, default: null })
  recordedById!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recordedById' })
  recordedBy!: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
