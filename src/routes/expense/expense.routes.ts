import { Router } from 'express';
import { ExpenseFactory } from '../../factory/expense/expense.factory';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreateExpenseDto } from '../../dto/expense/create-expense.dto';
import { UpdateExpenseDto } from '../../dto/expense/update-expense.dto';
import { requireParam } from '../../decorators/http.decorator';

const expenseRouter = Router();
const expenseController = ExpenseFactory.create();

expenseRouter.use(authenticate, requireRoles(IROLES.OWNER, IROLES.ADMIN));

expenseRouter.get('/', expenseController.list);
expenseRouter.post('/', validateDto(CreateExpenseDto), expenseController.create);
expenseRouter.get('/:id', requireParam('id'), expenseController.getById);
expenseRouter.put(
  '/:id',
  requireParam('id'),
  validateDto(UpdateExpenseDto),
  expenseController.update,
);
expenseRouter.patch(
  '/:id',
  requireParam('id'),
  validateDto(UpdateExpenseDto),
  expenseController.update,
);
expenseRouter.delete('/:id', requireParam('id'), expenseController.remove);

export { expenseRouter };
