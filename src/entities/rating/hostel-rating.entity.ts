// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-rating.entity.ts
// PURPOSE: Stores user/resident review ratings and feedback comments for hostels.
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

@Entity('hostel_ratings')
@Index('idx_hostel_ratings_hostel_id', ['hostelId'])
@Index('idx_hostel_ratings_user_id', ['userId'])
@Index('uq_hostel_ratings_hostel_user', ['hostelId', 'userId'], {
  unique: true,
  where: '"userId" IS NOT NULL',
})
export class HostelRating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, (hostel) => hostel.ratings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'uuid', nullable: true, default: null })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user!: User | null;

  @Column({ type: 'smallint', nullable: false })
  rating!: number;

  @Column({ type: 'text', nullable: true, default: null })
  comment!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
