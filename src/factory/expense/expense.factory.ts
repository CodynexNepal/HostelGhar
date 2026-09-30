import { ExpenseController } from '../../controller/expense/expense.controller';
import { ExpenseRepository } from '../../repository/expense/expense.repository';
import { ExpenseService } from '../../services/expense/expense.service';

export class ExpenseFactory {
  private constructor() {}

  public static create(): ExpenseController {
    return new ExpenseController(new ExpenseService(new ExpenseRepository()));
  }
}
