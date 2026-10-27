"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacilityController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const http_decorator_1 = require("../../decorators/http.decorator");
class FacilityController {
    constructor(service) {
        this.service = service;
        this.list = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const r = await this.service.list(hostelId);
                if ('error' in r) {
                    res.status(r.error.status).json({ success: false, message: r.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...r });
            }
            catch (e) {
                next(e);
            }
        };
        this.sync = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const dto = req.body;
                const items = (dto.facilities ?? []).map((f) => ({
                    clientKey: f.id?.trim() ? f.id.trim() : null,
                    title: f.title.trim(),
                    description: f.description?.trim() ? f.description : null,
                    tag: f.tag,
                }));
                const r = await this.service.sync(hostelId, items);
                if ('error' in r) {
                    res.status(r.error.status).json({ success: false, message: r.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, message: 'Facilities synced', ...r });
            }
            catch (e) {
                next(e);
            }
        };
        this.add = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const f = req.body;
                const r = await this.service.add(hostelId, {
                    clientKey: f.id?.trim() ? f.id.trim() : null,
                    title: f.title.trim(),
                    description: f.description?.trim() ? f.description : null,
                    tag: f.tag,
                });
                if ('error' in r) {
                    res.status(r.error.status).json({ success: false, message: r.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({ success: true, message: 'Facility added', ...r });
            }
            catch (e) {
                next(e);
            }
        };
        this.remove = async (req, res, next) => {
            try {
                const hostelId = (0, http_decorator_1.getRequiredParam)(req, 'hostelId');
                const fkey = (0, http_decorator_1.getRequiredParam)(req, 'facilityKey');
                const r = await this.service.remove(hostelId, fkey);
                if ('error' in r) {
                    res.status(r.error.status).json({ success: false, message: r.error.message });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, message: 'Facility removed', ...r });
            }
            catch (e) {
                next(e);
            }
        };
    }
}
exports.FacilityController = FacilityController;
