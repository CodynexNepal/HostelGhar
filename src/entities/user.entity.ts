// ──────────────────────────────────────────────────────────────────────────────
// FILE: user.entity.ts
// PURPOSE: Defines the `User` database table schema using TypeORM decorators.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { IROLES } from '../constant/enum.constant';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  firstName!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  lastName!: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  password!: string;

  // Profile avatar metadata
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  avatarPublicId!: string | null;

  @Column({ type: 'enum', enum: IROLES, default: IROLES.USER })
  role!: IROLES;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  refreshToken!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  passwordResetToken!: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  passwordResetExpiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
