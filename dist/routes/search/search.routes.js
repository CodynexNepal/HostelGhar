"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: search.routes.ts
// PURPOSE: Global search route mounted on the API.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRouter = void 0;
const express_1 = require("express");
const search_controller_1 = require("../../controller/search/search.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', search_controller_1.searchController.search);
exports.searchRouter = router;
