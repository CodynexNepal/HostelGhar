"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: search.controller.ts
// PURPOSE: HTTP handler for unified global search across all roles.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchController = exports.SearchController = void 0;
const search_service_1 = require("../../services/search/search.service");
const statusCode_interface_1 = require("../../constant/statusCode.interface");
class SearchController {
    constructor(service = search_service_1.searchService) {
        this.service = service;
        this.search = async (req, res, next) => {
            try {
                const userId = req.user.userId;
                const role = req.user.role;
                const q = typeof req.query.q === 'string' ? req.query.q : '';
                const category = typeof req.query.category === 'string' ? req.query.category : undefined;
                const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
                const hostelId = typeof req.query.hostelId === 'string' ? req.query.hostelId : undefined;
                const data = await this.service.search(userId, role, q, category, limit, hostelId);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    data,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.SearchController = SearchController;
exports.searchController = new SearchController();
