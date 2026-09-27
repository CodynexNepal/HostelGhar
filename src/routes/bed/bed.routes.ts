import { Router } from 'express';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { IROLES } from '../../enum/roles.enum';
import { validateDto } from '../../middleware/validate-dto.middleware';
import { CreateBedDto } from '../../dto/bed/create-bed.dto';
import { BedFactory } from '../../factory/bed/bed.factory';

const bedRouter = Router();
const bedController = BedFactory.create();

bedRouter.use(authenticate, requireRoles(IROLES.OWNER, IROLES.ADMIN));

bedRouter.get('/', bedController.listBeds);
bedRouter.post('/', validateDto(CreateBedDto), bedController.createBed);

export { bedRouter };
