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
import { ExpenseCategory, ExpenseStatus } from '../../enum/expense.enum';

@Entity('expenses')
@Index('idx_expenses_hostel_date', ['hostelId', 'expenseDate'])
@Index('idx_expenses_hostel_category', ['hostelId', 'category'])
@Index('idx_expenses_status', ['status'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  hostelId!: string;

  @ManyToOne(() => Hostel, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'hostelId' })
  hostel!: Hostel;

  @Column({ type: 'varchar', length: 150, nullable: false })
  title!: string;

  @Column({ type: 'enum', enum: ExpenseCategory, nullable: false })
  category!: ExpenseCategory;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: false })
  amount!: number;

  @Column({ type: 'date', nullable: false })
  expenseDate!: string;

  @Column({ type: 'text', nullable: true, default: null })
  notes!: string | null;

  @Column({ type: 'enum', enum: ExpenseStatus, default: ExpenseStatus.PAID })
  status!: ExpenseStatus;

  @Column({ type: 'uuid', nullable: false })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
