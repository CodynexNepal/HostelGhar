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
import { Room } from '../room/room.entity';
import { User } from '../user.entity';
import { BedStatus } from '../../enum/bed.enum';

@Entity('beds')
@Unique('uq_bed_hostel_room_number', ['hostelId', 'roomId', 'bedNumber'])
@Index('idx_beds_hostel_id', ['hostelId'])
@Index('idx_beds_room_id', ['roomId'])
@Index('idx_beds_owner_id', ['ownerId'])
@Index('idx_beds_status', ['status'])
export class Bed {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'uuid', nullable: false })
  roomId!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'roomId' })
  room!: Room;

  @Column({ type: 'varchar', length: 20, nullable: false })
  bedNumber!: string;

  @Column({ type: 'enum', enum: BedStatus, default: BedStatus.AVAILABLE })
  status!: BedStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, default: null })
  rentAmount!: number | null;

  @Column({ type: 'uuid', nullable: false })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
