"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeFactory = void 0;
const fee_controller_1 = require("../../controller/fee/fee.controller");
const fee_repository_1 = require("../../repository/fee/fee.repository");
const fee_service_1 = require("../../services/fee/fee.service");
class FeeFactory {
    constructor() { }
    static create() {
        const feeRepository = new fee_repository_1.FeeRepository();
        const feeService = new fee_service_1.FeeService(feeRepository);
        return new fee_controller_1.FeeController(feeService);
    }
}
exports.FeeFactory = FeeFactory;
