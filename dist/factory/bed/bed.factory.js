"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedFactory = void 0;
const bed_controller_1 = require("../../controller/bed/bed.controller");
const bed_repository_1 = require("../../repository/bed/bed.repository");
const bed_service_1 = require("../../services/bed/bed.service");
class BedFactory {
    constructor() { }
    static create() {
        const bedRepository = new bed_repository_1.BedRepository();
        const bedService = new bed_service_1.BedService(bedRepository);
        return new bed_controller_1.BedController(bedService);
    }
}
exports.BedFactory = BedFactory;
