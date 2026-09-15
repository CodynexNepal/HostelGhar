// ──────────────────────────────────────────────────────────────────────────────
// FILE: room.entity.ts
// PURPOSE: Stores Room information created by an Owner (User with role 'owner').
//          Optionally linked to a Hostel. Supports room inventory management
//          with availability status, occupancy tracking and Cloudinary image.
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
import { User } from '../user.entity';
import { Hostel } from '../hostel/hostel.entity';
import { RoomStatus, RoomType } from '../../enum/room.enum';

@Entity('rooms')
@Unique('uq_owner_room_number', ['ownerId', 'roomNumber'])
@Index('idx_rooms_owner_id', ['ownerId'])
@Index('idx_rooms_hostel_id', ['hostelId'])
@Index('idx_rooms_status', ['status'])
@Index('idx_rooms_type', ['type'])
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  roomNumber!: string;

  @Column({ type: 'enum', enum: RoomType, nullable: false })
  type!: RoomType;

  @Column({ type: 'int', nullable: false })
  capacity!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  monthlyRent!: number;

  @Column({ type: 'text', array: true, default: '{}' })
  amenities!: string[];

  @Column({ type: 'int', nullable: true, default: null })
  floor!: number | null;

  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.AVAILABLE })
  status!: RoomStatus;

  @Column({ type: 'int', default: 0 })
  occupied!: number;

  // Cloudinary room image metadata
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  imageUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  imagePublicId!: string | null;

  // ─── Owner reference (who created this room) ──────────────────────────
  @Column({ type: 'uuid', nullable: false })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  // ─── Optional Hostel link (room can belong to a hostel) ──────────────
  @Column({ type: 'uuid', nullable: true, default: null })
  hostelId!: string | null;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
