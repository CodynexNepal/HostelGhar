"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequiredParam = exports.requireParam = void 0;
const statusCode_interface_1 = require("../constant/statusCode.interface");
const requireParam = (name) => {
    return (req, res, next) => {
        const value = req.params[name];
        if (typeof value !== 'string' || value.trim() === '') {
            res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: `Missing or invalid route parameter: ${name}`,
            });
            return;
        }
        next();
    };
};
exports.requireParam = requireParam;
const getRequiredParam = (req, name) => {
    const value = req.params[name];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Missing required route parameter after validation: ${name}`);
    }
    return value;
};
exports.getRequiredParam = getRequiredParam;
