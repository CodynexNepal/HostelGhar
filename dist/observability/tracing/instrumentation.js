"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownTelemetry = exports.startTelemetry = void 0;
var telemetry_1 = require("../telemetry");
Object.defineProperty(exports, "startTelemetry", { enumerable: true, get: function () { return telemetry_1.startTelemetry; } });
Object.defineProperty(exports, "shutdownTelemetry", { enumerable: true, get: function () { return telemetry_1.shutdownTelemetry; } });
const telemetry_2 = require("../telemetry");
(0, telemetry_2.startTelemetry)();
