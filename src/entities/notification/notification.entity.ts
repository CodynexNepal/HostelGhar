// ──────────────────────────────────────────────────────────────────────────────
// FILE: notification.entity.ts
// PURPOSE: Stores user and role notifications with read tracking, entity metadata,
//          and fast indexing for unread badge counters.
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

@Entity('notifications')
@Index('idx_notifications_user_is_read', ['userId', 'isRead'])
@Index('idx_notifications_user_created', ['userId', 'createdAt'])
@Index('idx_notifications_user_entity', ['userId', 'entityType', 'isRead'])
@Index('idx_notifications_hostel_id', ['hostelId'])
@Index('idx_notifications_type', ['type'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid', nullable: true })
  hostelId!: string | null;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel | null;

  @Column({ type: 'varchar', length: 60, nullable: false })
  type!: string;

  @Column({ type: 'varchar', length: 200, nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: false })
  message!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  entityType!: string;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  entityId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  targetUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  metadata!: Record<string, any> | null;

  @Column({ type: 'boolean', default: false, nullable: false })
  isRead!: boolean;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  readAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
