"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceFactory = void 0;
const attendance_controller_1 = require("../../controller/attendance/attendance.controller");
const attendance_repository_1 = require("../../repository/attendance/attendance.repository");
const attendance_service_1 = require("../../services/attendance/attendance.service");
class AttendanceFactory {
    constructor() { }
    static create() {
        return new attendance_controller_1.AttendanceController(new attendance_service_1.AttendanceService(new attendance_repository_1.AttendanceRepository()));
    }
}
exports.AttendanceFactory = AttendanceFactory;
