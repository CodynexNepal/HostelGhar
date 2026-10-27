"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.livenessHandler = void 0;
const livenessHandler = (_req, res) => {
    res.status(200).json({ status: 'ok' });
};
exports.livenessHandler = livenessHandler;
