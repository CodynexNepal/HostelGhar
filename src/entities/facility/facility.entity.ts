// ──────────────────────────────────────────────────────────────────────────────
// FILE: facility.entity.ts
// PURPOSE: Canonical facility catalog (1NF/2NF/3NF master table).
//          One row per REAL-WORLD facility (Wifi, Security, Meals...) — never
//          duplicated per hostel. Hostels link via hostel_facilities (M:N).
//          Frontend `id` like "security-mu5ofghs" is a CLIENT key -> clientKey
//          on the junction row, NOT the DB primary key.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { HostelFacility } from './hostel-facility.entity';

@Entity('facilities')
@Unique('uq_facilities_slug', ['slug'])
export class Facility {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Canonical human name, e.g. "Security", "High-Speed Wifi"
  @Column({ type: 'varchar', length: 120, nullable: false })
  title!: string;

  // Normalized slug used for deduping: "security", "high-speed-wifi".
  // Lowercase + trimmed; unique across the catalog.
  @Column({ type: 'varchar', length: 140, nullable: false })
  @Index('idx_facilities_slug')
  slug!: string;

  @OneToMany(() => HostelFacility, (hf) => hf.facility)
  hostelFacilities!: HostelFacility[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
