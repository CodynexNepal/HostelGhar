import { RoomController } from '../../controller/room/room.controller';
import { RoomRepository } from '../../repository/room/room.repository';
import { RoomService } from '../../services/room/room.service';

export class RoomFactory {
  private constructor() {}

  public static create(): RoomController {
    const roomRepository = new RoomRepository();
    const roomService = new RoomService(roomRepository);
    return new RoomController(roomService);
  }
}
