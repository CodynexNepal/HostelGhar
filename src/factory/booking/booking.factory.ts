import { BookingController } from '../../controller/booking/booking.controller';
import { BookingRepository } from '../../repository/booking/booking.repository';
import { BookingService } from '../../services/booking/booking.service';

export class BookingFactory {
  private constructor() {}

  public static create(): BookingController {
    const bookingRepository = new BookingRepository();
    const bookingService = new BookingService(bookingRepository);
    return new BookingController(bookingService);
  }
}
