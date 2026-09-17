// ──────────────────────────────────────────────────────────────────────────────
// FILE: hostel-facility.entity.ts
// PURPOSE: Junction table hostel_facilities (hostel M:N facility).
//          Holds ONLY per-hostel facts: description + tag + clientKey.
//          Title/slug live once in facilities (no data redundancy).
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
import { Facility } from './facility.entity';
import { FacilityTag } from '../../enum/facility.enum';

@Entity('hostel_facilities')
@Index('uq_hostel_facility', ['hostelId', 'facilityId'], { unique: true })
@Index('uq_hostel_facility_client_key', ['hostelId', 'clientKey'], {
  unique: true,
  where: '"clientKey" IS NOT NULL',
})
export class HostelFacility {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  @Index('idx_hostel_facilities_hostel_id')
  hostelId!: string;

  @ManyToOne(() => Hostel, (hostel) => hostel.hostelFacilities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'uuid', nullable: false })
  @Index('idx_hostel_facilities_facility_id')
  facilityId!: string;

  @ManyToOne(() => Facility, (facility) => facility.hostelFacilities, {
    onDelete: 'RESTRICT',
    eager: false,
  })
  @JoinColumn({ name: 'facilityId' })
  facility!: Facility;

  // Per-hostel detail, e.g. "24 security with guards"
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  description!: string | null;

  @Column({ type: 'enum', enum: FacilityTag, default: FacilityTag.INCLUDED })
  @Index('idx_hostel_facilities_tag')
  tag!: FacilityTag;

  // Frontend-generated stable key e.g. "security-mu5ofghs".
  // Stored for idempotent sync / drag-order; NULL when not sent.
  @Column({ type: 'varchar', length: 120, nullable: true, default: null })
  clientKey!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
