import { NextFunction, Request, Response } from 'express';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { CreateExpenseDto } from '../../dto/expense/create-expense.dto';
import { UpdateExpenseDto } from '../../dto/expense/update-expense.dto';
import { ExpenseCategory, ExpenseStatus } from '../../enum/expense.enum';
import { getRequiredParam } from '../../decorators/http.decorator';
import { normalizePagination } from '../../utils/pagination.util';
import { ExpenseService } from '../../services/expense/expense.service';
import { createHttpError } from '../../utils/createHttpError';

export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.expenseService.create(
        req.user!.userId,
        req.user!.role,
        req.body as CreateExpenseDto,
      );
      res.status(STATUS_CODE.CREATED).json({ success: true, message: 'Expense created', data });
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = normalizePagination({
        page: req.query.page as string,
        limit: req.query.limit as string,
      });
      const category = this.enumQuery(req.query.category, ExpenseCategory, 'category');
      const status = this.enumQuery(req.query.status, ExpenseStatus, 'status');
      const result = await this.expenseService.list(req.user!.userId, req.user!.role, {
        page,
        limit,
        category,
        status,
        hostelId: typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined,
      });
      res.status(STATUS_CODE.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.expenseService.getById(
        req.user!.userId,
        req.user!.role,
        getRequiredParam(req, 'id'),
      );
      res.status(STATUS_CODE.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.expenseService.update(
        req.user!.userId,
        req.user!.role,
        getRequiredParam(req, 'id'),
        req.body as UpdateExpenseDto,
      );
      res.status(STATUS_CODE.OK).json({ success: true, message: 'Expense updated', data });
    } catch (error) {
      next(error);
    }
  };

  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.expenseService.remove(
        req.user!.userId,
        req.user!.role,
        getRequiredParam(req, 'id'),
      );
      res.status(STATUS_CODE.DELETED).json({ success: true, message: 'Expense deleted' });
    } catch (error) {
      next(error);
    }
  };

  private enumQuery<T extends Record<string, string>>(
    value: unknown,
    values: T,
    name: string,
  ): T[keyof T] | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.toUpperCase();
    if (!(normalized in values)) {
      throw createHttpError(STATUS_CODE.BAD_REQUEST, `${name} is invalid`);
    }
    return normalized as T[keyof T];
  }
}
