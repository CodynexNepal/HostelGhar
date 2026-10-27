"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeJsonLog = void 0;
const writeJsonLog = (entry) => {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
};
exports.writeJsonLog = writeJsonLog;
