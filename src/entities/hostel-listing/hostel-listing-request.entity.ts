import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ListingRequestStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('hostel_listing_requests')
@Index('idx_listing_requests_email', ['email'])
@Index('idx_listing_requests_phone', ['phone'])
@Index('idx_listing_requests_status', ['status'])
export class HostelListingRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  hostelName!: string;

  @Column({ type: 'varchar', length: 50, default: 'coed' })
  type!: string;

  @Column({ type: 'int', default: 0 })
  totalBeds!: number;

  @Column({ type: 'varchar', length: 50 })
  phone!: string;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  area!: string | null;

  @Column({ type: 'text' })
  address!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceFrom!: number | null;

  @Column({ type: 'boolean', default: false })
  negotiable!: boolean;

  @Column({ type: 'text', array: true, default: '{}' })
  amenities!: string[];

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  rules!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  photos!: string[];

  @Column({ type: 'varchar', length: 150 })
  ownerName!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({
    type: 'enum',
    enum: ListingRequestStatus,
    default: ListingRequestStatus.PENDING,
  })
  status!: ListingRequestStatus;

  @Column({ type: 'text', nullable: true })
  adminNotes!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
