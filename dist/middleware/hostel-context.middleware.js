"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveHostelId = void 0;
const statusCode_interface_1 = require("../constant/statusCode.interface");
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const getRequestedHostelId = (req) => req.params.hostelId ||
    req.params.id ||
    req.query?.hostelId ||
    req.body?.hostelId ||
    req.headers['x-hostel-id'];
const resolveHostelId = (req, res, next) => {
    const requestedHostelId = getRequestedHostelId(req);
    const hostelId = Array.isArray(requestedHostelId)
        ? requestedHostelId[0]
        : typeof requestedHostelId === 'string'
            ? requestedHostelId.trim()
            : undefined;
    if (!hostelId || !UUID_V4_PATTERN.test(hostelId)) {
        res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
            success: false,
            message: 'A valid hostelId is required in the request body, route, or X-Hostel-Id header.',
        });
        return;
    }
    req.hostelId = hostelId;
    next();
};
exports.resolveHostelId = resolveHostelId;
