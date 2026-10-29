// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-daily-meal.entity.ts
// PURPOSE: Stores daily meal schedule slots (दैनिक भोजन तालिका) for a hostel.
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

@Entity('hostel_daily_meals')
@Index('idx_hostel_daily_meals_hostel_id', ['hostelId'])
@Index('idx_hostel_daily_meals_hostel_order', ['hostelId', 'orderIndex'])
@Index('idx_hostel_daily_meals_hostel_day_order', ['hostelId', 'dayOfWeek', 'orderIndex'])
export class HostelDailyMeal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, (hostel) => hostel.dailyMeals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  /** Day of week (e.g. ALL, SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY) */
  @Column({ type: 'varchar', length: 20, default: 'ALL', nullable: false })
  dayOfWeek!: string;

  /** Nepali meal name, e.g. बिहानको नास्ता, बिहानको खाजा, दिउँसोको खाना */
  @Column({ type: 'varchar', length: 100, nullable: false })
  mealName!: string;

  /** English translation / subtitle, e.g. Morning Breakfast, Lunch / Khana */
  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  mealNameEn!: string | null;

  /** Serving time window, e.g. "7:00 AM–8:00 AM" */
  @Column({ type: 'varchar', length: 100, nullable: false })
  time!: string;

  /** Menu items, food description or dietary details */
  @Column({ type: 'varchar', length: 1000, nullable: true, default: null })
  menuDescription!: string | null;

  /** Active or inactive status (अवस्था: सक्रिय / निष्क्रिय) */
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /** Row order / sequence (क्र.सं. 1, 2, 3...) */
  @Column({ type: 'int', default: 0 })
  orderIndex!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
