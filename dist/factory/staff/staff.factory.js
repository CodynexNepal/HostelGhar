"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffFactory = void 0;
const staff_controller_1 = require("../../controller/staff/staff.controller");
const staff_repository_1 = require("../../repository/staff/staff.repository");
const staff_service_1 = require("../../services/staff/staff.service");
class StaffFactory {
    constructor() { }
    static create() {
        return new staff_controller_1.StaffController(new staff_service_1.StaffService(new staff_repository_1.StaffRepository()));
    }
}
exports.StaffFactory = StaffFactory;
