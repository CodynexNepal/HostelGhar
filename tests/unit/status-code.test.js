"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const statusCode_interface_1 = require("../../src/constant/statusCode.interface");
(0, vitest_1.describe)('STATUS_CODE', () => {
    (0, vitest_1.it)('exposes the standard success and error status codes', () => {
        (0, vitest_1.expect)(statusCode_interface_1.STATUS_CODE.OK).toBe(200);
        (0, vitest_1.expect)(statusCode_interface_1.STATUS_CODE.CREATED).toBe(201);
        (0, vitest_1.expect)(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).toBe(400);
        (0, vitest_1.expect)(statusCode_interface_1.STATUS_CODE.NOT_FOUND).toBe(404);
        (0, vitest_1.expect)(statusCode_interface_1.STATUS_CODE.INTERNAL_SERVER_ERROR).toBe(500);
    });
});
