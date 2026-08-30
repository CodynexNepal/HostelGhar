import { ResidentRepository } from '../../repository/resident/resident.repository';

export class ResidentService {
  constructor(private readonly residentRepository?: ResidentRepository) {}
}
