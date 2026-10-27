"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostelFactory = void 0;
const hostel_controller_1 = require("../../controller/hostel/hostel.controller");
const hostel_repository_1 = require("../../repository/hostel/hostel.repository");
const hostel_service_1 = require("../../services/hostel/hostel.service");
class HostelFactory {
    constructor() { }
    static create() {
        const hostelRepository = new hostel_repository_1.HostelRepository();
        const hostelService = new hostel_service_1.HostelService(hostelRepository);
        return new hostel_controller_1.HostelController(hostelService);
    }
}
exports.HostelFactory = HostelFactory;
