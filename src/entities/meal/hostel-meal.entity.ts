// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-meal.entity.ts
// PURPOSE: Stores weekly meal schedules (Breakfast & Main Meal) for a hostel.
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
import { DayOfWeek } from '../../enum/meal.enum';

@Entity('hostel_meals')
@Index('idx_hostel_meals_hostel_id', ['hostelId'])
@Index('idx_hostel_meals_hostel_day', ['hostelId', 'dayOfWeek'], { unique: true })
export class HostelMeal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, (hostel) => hostel.meals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'enum', enum: DayOfWeek, nullable: false })
  dayOfWeek!: DayOfWeek;

  @Column({ type: 'varchar', length: 1000, nullable: true, default: null })
  breakfastDescription!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  breakfastTime!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  breakfastNotes!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true, default: null })
  mainMealDescription!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  mainMealTime!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  mainMealNotes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

