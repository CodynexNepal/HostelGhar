import { Repository, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../database/database-source';
import { Expense } from '../../entities/expense/expense.entity';
import { ExpenseCategory, ExpenseStatus } from '../../enum/expense.enum';

export interface ExpenseFilters {
  hostelId?: string | undefined;
  hostelIds?: string[] | undefined;
  category?: ExpenseCategory | undefined;
  status?: ExpenseStatus | undefined;
}

export class ExpenseRepository {
  private readonly expenseRepo: Repository<Expense> = AppDataSource.getRepository(Expense);

  public create(data: Partial<Expense>): Expense {
    return this.expenseRepo.create(data);
  }

  public save(expense: Expense): Promise<Expense> {
    return this.expenseRepo.save(expense);
  }

  public findById(id: string): Promise<Expense | null> {
    return this.expenseRepo.findOne({ where: { id }, relations: { hostel: true } });
  }

  public findPage(
    filters: ExpenseFilters,
    page: number,
    limit: number,
  ): Promise<[Expense[], number]> {
    const query = this.applyFilters(this.expenseRepo.createQueryBuilder('expense'), filters);
    return query
      .leftJoinAndSelect('expense.hostel', 'hostel')
      .orderBy('expense.expenseDate', 'DESC')
      .addOrderBy('expense.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }

  public remove(expense: Expense): Promise<Expense> {
    return this.expenseRepo.remove(expense);
  }

  private applyFilters(
    query: SelectQueryBuilder<Expense>,
    { hostelId, hostelIds, category, status }: ExpenseFilters,
  ): SelectQueryBuilder<Expense> {
    if (hostelId) query.andWhere('expense.hostelId = :hostelId', { hostelId });
    else if (hostelIds) query.andWhere('expense.hostelId IN (:...hostelIds)', { hostelIds });
    if (category) query.andWhere('expense.category = :category', { category });
    if (status) query.andWhere('expense.status = :status', { status });
    return query;
  }
}
