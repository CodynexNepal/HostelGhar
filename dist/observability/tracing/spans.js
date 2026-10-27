"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withSpan = void 0;
const tracer_1 = require("./tracer");
const withSpan = async (name, operation) => tracer_1.tracer.startActiveSpan(name, async (span) => {
    try {
        return await operation();
    }
    finally {
        span.end();
    }
});
exports.withSpan = withSpan;
