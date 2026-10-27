"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpActiveRequests = exports.httpRequestDuration = exports.httpRequestsTotal = void 0;
var metrics_1 = require("../metrics");
Object.defineProperty(exports, "httpRequestsTotal", { enumerable: true, get: function () { return metrics_1.httpRequestsTotal; } });
Object.defineProperty(exports, "httpRequestDuration", { enumerable: true, get: function () { return metrics_1.httpRequestDuration; } });
Object.defineProperty(exports, "httpActiveRequests", { enumerable: true, get: function () { return metrics_1.httpActiveRequests; } });
