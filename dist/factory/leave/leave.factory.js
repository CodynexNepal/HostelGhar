"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveFactory = void 0;
const leave_controller_1 = require("../../controller/leave/leave.controller");
const leave_repository_1 = require("../../repository/leave/leave.repository");
const leave_service_1 = require("../../services/leave/leave.service");
class LeaveFactory {
    constructor() { }
    static create() {
        const leaveRepository = new leave_repository_1.LeaveRepository();
        const leaveService = new leave_service_1.LeaveService(leaveRepository);
        return new leave_controller_1.LeaveController(leaveService);
    }
}
exports.LeaveFactory = LeaveFactory;
