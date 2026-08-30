// ──────────────────────────────────────────────────────────────────────────────
// FILE: booking.entity.ts
// PURPOSE: Stores hostel booking applications made by Users with role 'USER'.
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
import { BookingStatus } from '../../enum/booking.enum';

@Entity('bookings')
@Index('idx_bookings_user_status', ['userId', 'status'])
@Index('idx_bookings_hostel_status', ['hostelId', 'status'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'date', nullable: false })
  checkInDate!: string;

  @Column({ type: 'text', nullable: true })
  remarks!: string | null;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
