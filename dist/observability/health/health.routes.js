"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const liveness_1 = require("./liveness");
const readiness_1 = require("./readiness");
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get('/live', liveness_1.livenessHandler);
exports.healthRouter.get('/ready', readiness_1.readinessHandler);
