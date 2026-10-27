"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownWorkers = exports.bootstrapWorkers = void 0;
var workers_boostrap_1 = require("../../workers/workers.boostrap");
Object.defineProperty(exports, "bootstrapWorkers", { enumerable: true, get: function () { return workers_boostrap_1.bootstrapWorkers; } });
Object.defineProperty(exports, "shutdownWorkers", { enumerable: true, get: function () { return workers_boostrap_1.shutdownWorkers; } });
