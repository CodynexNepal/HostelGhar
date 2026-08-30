import { Router } from 'express';
import { HostelFactory } from '../../factory/hostel/hostel.factory';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { apiReadLimiter } from '../../configs/rateLimiter.config';
import { requireParam } from '../../decorators/http.decorator';

const hostelRouter = Router();
const hostelController = HostelFactory.create();

hostelRouter.use(authenticate);
hostelRouter.get('/', apiReadLimiter, hostelController.listHostels);
hostelRouter.get('/:id', requireParam('id'), apiReadLimiter, hostelController.getHostel);
hostelRouter.get(
  '/:id/residents',
  requireParam('id'),
  requireRoles(IROLES.ADMIN, IROLES.OWNER),
  hostelController.getResidents,
);
hostelRouter.get('/:id/leave-types', requireParam('id'), hostelController.getLeaveTypes);

export { hostelRouter };
