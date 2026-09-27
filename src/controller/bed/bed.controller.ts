import { NextFunction, Request, Response } from 'express';
import { CreateBedDto } from '../../dto/bed/create-bed.dto';
import { STATUS_CODE } from '../../constant/statusCode.interface';
import { BedService } from '../../services/bed/bed.service';

export class BedController {
  constructor(private readonly bedService: BedService) {}

  public listBeds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;

      const result = await this.bedService.listBeds(ownerId, hostelId);

      res.status(STATUS_CODE.OK).json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  public createBed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.userId;
      const dto = req.body as CreateBedDto;

      const result = await this.bedService.createBed(ownerId, dto);

      if (result.error) {
        res.status(result.error.status).json({ success: false, message: result.error.message });
        return;
      }

      res.status(STATUS_CODE.CREATED).json({
        success: true,
        message: 'Bed added successfully',
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };
}
