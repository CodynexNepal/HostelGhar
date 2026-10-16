import { Router } from 'express';
import { StaffFactory } from '../../factory/staff/staff.factory';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreateStaffDto } from '../../dto/staff/create-staff.dto';
import { UpdateStaffDto } from '../../dto/staff/update-staff.dto';
import { requireParam } from '../../decorators/http.decorator';
import { apiReadLimiter } from '../../configs/rateLimiter.config';
import {
  normalizeStaffFields,
  stripFileFields,
  uploadStaffPhoto,
} from '../../middleware/upload.middleware';

const staffRouter = Router();
const staffController = StaffFactory.create();

staffRouter.use(authenticate, requireRoles(IROLES.OWNER, IROLES.ADMIN));

staffRouter.get('/', apiReadLimiter, staffController.list);
staffRouter.post(
  '/',
  uploadStaffPhoto,
  stripFileFields('photo'),
  normalizeStaffFields,
  validateDto(CreateStaffDto),
  staffController.create,
);
staffRouter.get('/:id', requireParam('id'), apiReadLimiter, staffController.getById);
staffRouter.put(
  '/:id',
  requireParam('id'),
  uploadStaffPhoto,
  stripFileFields('photo'),
  normalizeStaffFields,
  validateDto(UpdateStaffDto),
  staffController.update,
);
staffRouter.patch(
  '/:id',
  requireParam('id'),
  uploadStaffPhoto,
  stripFileFields('photo'),
  normalizeStaffFields,
  validateDto(UpdateStaffDto),
  staffController.update,
);
staffRouter.delete('/:id', requireParam('id'), staffController.remove);

export { staffRouter };
