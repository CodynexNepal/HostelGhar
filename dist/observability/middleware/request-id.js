"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = void 0;
var http_middleware_1 = require("../http.middleware");
Object.defineProperty(exports, "requestIdMiddleware", { enumerable: true, get: function () { return http_middleware_1.httpLoggingMiddleware; } });
