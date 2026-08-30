import { Router } from 'express';
import { LeaveFactory } from '../../factory/leave/leave.factory';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { requireParam } from '../../decorators/http.decorator';

const leaveRouter = Router();
const leaveController = LeaveFactory.create();

leaveRouter.use(authenticate, requireRoles(IROLES.ADMIN, IROLES.OWNER));
leaveRouter.get(
  '/hostels/:hostelId/requests',
  requireParam('hostelId'),
  leaveController.listHostelLeaves,
);
leaveRouter.patch('/requests/:id/status', requireParam('id'), leaveController.updateStatus);

export { leaveRouter };
