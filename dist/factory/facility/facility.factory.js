"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacilityFactory = void 0;
const facility_controller_1 = require("../../controller/facility/facility.controller");
const facility_repository_1 = require("../../repository/facility/facility.repository");
const facility_service_1 = require("../../services/facility/facility.service");
class FacilityFactory {
    constructor() { }
    static create() {
        const repo = new facility_repository_1.FacilityRepository();
        const service = new facility_service_1.FacilityService(repo);
        return new facility_controller_1.FacilityController(service);
    }
}
exports.FacilityFactory = FacilityFactory;
