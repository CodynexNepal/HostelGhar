import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CreateExpenseDto } from '../../dto/expense/create-expense.dto';
import { UpdateExpenseDto } from '../../dto/expense/update-expense.dto';
import { Expense } from '../../entities/expense/expense.entity';
import { ExpenseCategory, ExpenseStatus } from '../../enum/expense.enum';
import { IROLES } from '../../enum/roles.enum';
import { ExpenseRepository } from '../../repository/expense/expense.repository';
import { createHttpError } from '../../utils/createHttpError';
import { cacheService } from '../../utils/cache.util';
import { createPaginatedResponse, PaginatedResponse } from '../../utils/pagination.util';
import { AppDataSource } from '../../database/database-source';
import { Hostel } from '../../entities/hostel/hostel.entity';

interface ListOptions {
  page: number;
  limit: number;
  hostelId?: string | undefined;
  category?: ExpenseCategory | undefined;
  status?: ExpenseStatus | undefined;
}

export class ExpenseService {
  constructor(private readonly expenseRepository = new ExpenseRepository()) {}

  private isAdmin(role: string): boolean {
    return role.toLowerCase() === IROLES.ADMIN.toLowerCase();
  }

  private async authorizeHostel(actorId: string, role: string, hostelId: string): Promise<void> {
    const hostel = await AppDataSource.getRepository(Hostel).findOne({ where: { id: hostelId } });
    if (!hostel) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Hostel not found');
    if (!this.isAdmin(role) && hostel.ownerId !== actorId) {
      throw createHttpError(STATUS_CODE.FORBIDDEN, 'You do not manage this hostel');
    }
  }

  private async ownedHostelIds(ownerId: string): Promise<string[]> {
    const rows = await AppDataSource.getRepository(Hostel).find({
      where: { ownerId },
      select: { id: true },
    });
    return rows.map((hostel) => hostel.id);
  }

  public async create(actorId: string, role: string, dto: CreateExpenseDto): Promise<Expense> {
    await this.authorizeHostel(actorId, role, dto.hostelId);
    const expense = this.expenseRepository.create({
      hostelId: dto.hostelId,
      title: dto.title.trim(),
      category: dto.category,
      amount: dto.amount,
      expenseDate: dto.expenseDate,
      notes: dto.notes?.trim() || null,
      status: dto.status ?? ExpenseStatus.PAID,
      createdById: actorId,
    });
    const saved = await this.expenseRepository.save(expense);
    await this.invalidateExpenseCaches(saved.id);
    await this.invalidateAnalytics();
    return saved;
  }

  public async list(
    actorId: string,
    role: string,
    options: ListOptions,
  ): Promise<PaginatedResponse<Expense>> {
    const admin = this.isAdmin(role);

    // Single-hostel list: authorize first, then share one compressed cache entry
    // per hostel+filters+page (safe: every reader passed authorizeHostel).
    if (options.hostelId) {
      await this.authorizeHostel(actorId, role, options.hostelId);
      const cacheKey = cacheService.generateKey('expenses:hostel', {
        hostelId: options.hostelId,
        category: options.category ?? 'ALL',
        status: options.status ?? 'ALL',
        page: options.page,
        limit: options.limit,
      });
      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () => {
          const [expenses, total] = await this.expenseRepository.findPage(
            {
              hostelId: options.hostelId,
              category: options.category,
              status: options.status,
            },
            options.page,
            options.limit,
          );
          return { expenses, total };
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );
      return createPaginatedResponse(data.expenses, data.total, options, { isCached, cacheLevel });
    }

    // All-hostels list: admins see everything; owners only their hostels.
    // Owner key is actor-scoped so one owner can never read another's cache.
    if (admin) {
      const cacheKey = cacheService.generateKey('expenses:list', {
        scope: 'admin',
        category: options.category ?? 'ALL',
        status: options.status ?? 'ALL',
        page: options.page,
        limit: options.limit,
      });
      const { data, isCached, cacheLevel } = await cacheService.wrap(
        cacheKey,
        async () => {
          const [expenses, total] = await this.expenseRepository.findPage(
            { category: options.category, status: options.status },
            options.page,
            options.limit,
          );
          return { expenses, total };
        },
        { l1TtlSeconds: 30, l2TtlSeconds: 120 },
      );
      return createPaginatedResponse(data.expenses, data.total, options, {
        isCached,
        cacheLevel,
      });
    }

    const cacheKey = cacheService.generateKey('expenses:list', {
      scope: 'owner',
      actorId,
      category: options.category ?? 'ALL',
      status: options.status ?? 'ALL',
      page: options.page,
      limit: options.limit,
    });
    const { data, isCached, cacheLevel } = await cacheService.wrap(
      cacheKey,
      async () => {
        const hostelIds = await this.ownedHostelIds(actorId);
        if (!hostelIds.length) return { expenses: [] as Expense[], total: 0 };
        const [expenses, total] = await this.expenseRepository.findPage(
          { hostelIds, category: options.category, status: options.status },
          options.page,
          options.limit,
        );
        return { expenses, total };
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );
    return createPaginatedResponse(data.expenses, data.total, options, {
      isCached,
      cacheLevel,
    });
  }

  public async getById(actorId: string, role: string, id: string): Promise<Expense> {
    const cacheKey = cacheService.generateKey('expenses:detail', { id });
    const { data: expense } = await cacheService.wrap(
      cacheKey,
      async () => this.expenseRepository.findById(id),
      { l1TtlSeconds: 60, l2TtlSeconds: 300 },
    );
    if (!expense) throw createHttpError(STATUS_CODE.NOT_FOUND, 'Expense not found');
    await this.authorizeHostel(actorId, role, expense.hostelId);
    return expense;
  }

  public async update(
    actorId: string,
    role: string,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    const expense = await this.getById(actorId, role, id);
    if (dto.title !== undefined) expense.title = dto.title.trim();
    if (dto.category !== undefined) expense.category = dto.category;
    if (dto.amount !== undefined) expense.amount = dto.amount;
    if (dto.expenseDate !== undefined) expense.expenseDate = dto.expenseDate;
    if (dto.notes !== undefined) expense.notes = dto.notes?.trim() || null;
    if (dto.status !== undefined) expense.status = dto.status;
    const saved = await this.expenseRepository.save(expense);
    await this.invalidateExpenseCaches(saved.id);
    await this.invalidateAnalytics();
    return saved;
  }

  public async remove(actorId: string, role: string, id: string): Promise<void> {
    const expense = await this.getById(actorId, role, id);
    await this.expenseRepository.remove(expense);
    await this.invalidateExpenseCaches(id);
    await this.invalidateAnalytics();
  }

  private async invalidateExpenseCaches(expenseId?: string): Promise<void> {
    const tasks: Promise<void>[] = [
      cacheService.invalidatePattern('expenses:list'),
      cacheService.invalidatePattern('expenses:hostel'),
    ];
    if (expenseId) {
      tasks.push(
        cacheService.invalidate(cacheService.generateKey('expenses:detail', { id: expenseId })),
      );
    }
    await Promise.all(tasks);
  }

  private async invalidateAnalytics(): Promise<void> {
    await Promise.all([
      cacheService.invalidatePattern('analytics:owner'),
      cacheService.invalidatePattern('analytics:admin'),
    ]);
  }
}
